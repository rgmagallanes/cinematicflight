import { createHash } from "node:crypto";
import { resolve4, resolve6 } from "node:dns/promises";
import https from "node:https";
import net from "node:net";

export const WEBSITE_RESEARCH_LIMITS = Object.freeze({
  maxPages: 8,
  maxRedirects: 3,
  maxBodyBytes: 1024 * 1024,
  maxRobotsBytes: 128 * 1024,
  maxRequestMs: 15_000,
  maxRunMs: 60_000,
  maxObservations: 32,
  maxObservationChars: 1_000,
  userAgent: "CinematicFlightProspecting/1.0 (+https://cinematicflight.com)",
});

export type WebsiteObservationType =
  | "PAGE_METADATA" | "GALLERY" | "ACCOMMODATION" | "AMENITY" | "CONTACT"
  | "MATTERPORT_EMBED" | "INTERACTIVE_EXPERIENCE" | "VIDEO_EMBED"
  | "STREET_VIEW_EMBED" | "FLOORPLAN_MARKER";

export interface ResearchEvidenceDraft {
  source_type: "WEBSITE";
  source_url: string;
  page_title: string | null;
  observation_type: WebsiteObservationType;
  claim: string;
  observation: string;
  content_hash: string;
  captured_at: string;
}

export interface ResearchEvent {
  action: "INSPECT_WEBSITE" | "INSPECT_PAGE" | "SAVE_EVIDENCE" | "STOP_POLICY_BLOCKED" | "STOP_PAGE_LIMIT" | "STOP_TIME_LIMIT" | "STOP_TOOL_FAILURE" | "STOP_RESEARCH_COMPLETE";
  target: string | null;
  reason: string;
}

export interface ResearchResult {
  status: "COMPLETED" | "PARTIAL" | "BLOCKED" | "FAILED";
  stop_reason: "RESEARCH_COMPLETE" | "PAGE_LIMIT" | "TIME_LIMIT" | "POLICY_BLOCKED" | "TOOL_FAILURE";
  requested_url: string;
  canonical_host: string | null;
  pages_attempted: number;
  pages_succeeded: number;
  evidence: ResearchEvidenceDraft[];
  events: ResearchEvent[];
  started_at: string;
  completed_at: string;
}

export interface ResearchHttpResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
}

/**
 * Production transports must connect to `pinnedAddress` rather than resolving the
 * hostname again. They must retain `url.hostname` for Host/SNI verification.
 */
export interface ResearchTransport {
  resolve(hostname: string): Promise<readonly string[]>;
  fetch(input: {
    url: URL;
    pinnedAddress: string;
    timeoutMs: number;
    maxBodyBytes: number;
    userAgent: string;
  }): Promise<ResearchHttpResponse>;
}

export interface WebsiteResearchInput {
  requestedUrl: string;
  transport: ResearchTransport;
  now?: () => Date;
  limits?: Partial<typeof WEBSITE_RESEARCH_LIMITS>;
}

/** A production Node transport that validates DNS separately and pins the selected IP for HTTPS. */
export function createPinnedHttpsTransport(): ResearchTransport {
  return {
    async resolve(hostname) {
      const [ipv4, ipv6] = await Promise.all([
        resolve4(hostname).catch(() => [] as string[]),
        resolve6(hostname).catch(() => [] as string[]),
      ]);
      return [...ipv4, ...ipv6];
    },
    fetch({ url, pinnedAddress, timeoutMs, maxBodyBytes, userAgent }) {
      return new Promise((resolve, reject) => {
        const family = net.isIP(pinnedAddress);
        const request = https.request({
          protocol: "https:", hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`,
          method: "GET", agent: false, rejectUnauthorized: true, servername: url.hostname,
          maxHeaderSize: 16 * 1024, timeout: timeoutMs,
          lookup: (_hostname, _options, callback) => callback(null, pinnedAddress, family),
          headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9", "Accept-Encoding": "identity" },
        }, (response) => {
          const contentEncoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
          if (contentEncoding !== "identity") { response.resume(); reject(new WebsiteResearchPolicyError("Compressed website responses are not accepted.")); return; }
          const headers: Record<string, string | undefined> = {};
          for (const [key, value] of Object.entries(response.headers)) headers[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
          const declaredLength = Number(response.headers["content-length"] ?? 0);
          if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBodyBytes) { response.resume(); reject(new WebsiteResearchPolicyError("Website response exceeds the body limit.")); return; }
          const chunks: Buffer[] = []; let size = 0;
          response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBodyBytes) { request.destroy(new WebsiteResearchPolicyError("Website response exceeds the body limit.")); return; } chunks.push(chunk); });
          response.on("end", () => resolve({ status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("utf8") }));
        });
        request.once("timeout", () => request.destroy(new WebsiteResearchPolicyError("Website request timed out.")));
        request.once("error", reject);
        request.end();
      });
    },
  };
}

export class WebsiteResearchPolicyError extends Error {}

export async function researchWebsite(input: WebsiteResearchInput): Promise<ResearchResult> {
  const limits = { ...WEBSITE_RESEARCH_LIMITS, ...input.limits };
  const now = input.now ?? (() => new Date());
  const started = now();
  const events: ResearchEvent[] = [];
  const evidence: ResearchEvidenceDraft[] = [];
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let canonicalHost: string | null = null;
  let requested: URL;
  let robotsText: string | null = null;

  try {
    requested = parseInitialUrl(input.requestedUrl);
    canonicalHost = requested.hostname;
    const robots = await requestWithRedirects(new URL("/robots.txt", requested), canonicalHost, true, input.transport, limits, now, started);
    canonicalHost = robots.canonicalHost;
    if (requested.hostname !== canonicalHost) {
      requested = new URL(requested.toString());
      requested.hostname = canonicalHost;
    }
    if (robots.response.status === 404) {
      // A missing robots file is the conventional absence of a published policy.
    } else if (robots.response.status >= 200 && robots.response.status < 300) {
      if (!isPlainText(robots.response.headers["content-type"])) throw new WebsiteResearchPolicyError("robots.txt did not return plain text.");
      validateRobotsText(robots.response.body);
      robotsText = robots.response.body;
    } else {
      throw new WebsiteResearchPolicyError("robots.txt could not be read safely.");
    }

    const pending = [requested];
    const visited = new Set<string>();
    while (pending.length > 0 && pagesAttempted < limits.maxPages) {
      if (elapsedMs(now, started) >= limits.maxRunMs) return result("PARTIAL", "TIME_LIMIT");
      const next = pending.shift()!;
      const key = canonicalPageKey(next);
      if (visited.has(key)) continue;
      if (robotsText !== null && !isAllowedByRobots(robotsText, next.pathname, limits.userAgent)) {
        events.push({ action: "STOP_POLICY_BLOCKED", target: next.toString(), reason: "robots.txt denies this research user agent." });
        return result("BLOCKED", "POLICY_BLOCKED");
      }
      visited.add(key);
      pagesAttempted++;
      events.push({ action: pagesAttempted === 1 ? "INSPECT_WEBSITE" : "INSPECT_PAGE", target: next.toString(), reason: "Collect bounded first-party website observations." });
      const page = await requestWithRedirects(next, canonicalHost, false, input.transport, limits, now, started);
      canonicalHost = page.canonicalHost;
      if (page.response.status < 200 || page.response.status >= 300) continue;
      if (!isHtml(page.response.headers["content-type"])) continue;
      pagesSucceeded++;
      const extracted = extractEvidence(page.url, page.response.body, now(), limits.maxObservationChars);
      for (const item of extracted) {
        if (evidence.length >= limits.maxObservations) break;
        if (!evidence.some((known) => known.content_hash === item.content_hash)) {
          evidence.push(item);
          events.push({ action: "SAVE_EVIDENCE", target: item.source_url, reason: `Recorded observed ${item.observation_type} evidence.` });
        }
      }
      if (evidence.length >= limits.maxObservations) return result("PARTIAL", "PAGE_LIMIT");
      for (const link of selectResearchLinks(page.url, page.response.body, canonicalHost)) {
        if (!visited.has(canonicalPageKey(link)) && pending.length + visited.size < limits.maxPages) pending.push(link);
      }
    }
    return result(pending.length > 0 ? "PARTIAL" : "COMPLETED", pending.length > 0 ? "PAGE_LIMIT" : "RESEARCH_COMPLETE");
  } catch (error) {
    const blocked = error instanceof WebsiteResearchPolicyError;
    if (blocked) events.push({ action: "STOP_POLICY_BLOCKED", target: null, reason: error.message });
    return result(blocked ? "BLOCKED" : "FAILED", blocked ? "POLICY_BLOCKED" : "TOOL_FAILURE");
  }

  function result(status: ResearchResult["status"], stopReason: ResearchResult["stop_reason"]): ResearchResult {
    const terminalAction = { RESEARCH_COMPLETE: "STOP_RESEARCH_COMPLETE", PAGE_LIMIT: "STOP_PAGE_LIMIT", TIME_LIMIT: "STOP_TIME_LIMIT", POLICY_BLOCKED: "STOP_POLICY_BLOCKED", TOOL_FAILURE: "STOP_TOOL_FAILURE" }[stopReason] as ResearchEvent["action"];
    if (!events.some((event) => event.action === terminalAction)) events.push({ action: terminalAction, target: null, reason: `Website research stopped with ${stopReason}.` });
    return {
      status, stop_reason: stopReason, requested_url: input.requestedUrl, canonical_host: canonicalHost,
      pages_attempted: pagesAttempted, pages_succeeded: pagesSucceeded, evidence, events,
      started_at: started.toISOString(), completed_at: now().toISOString(),
    };
  }
}

function parseInitialUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new WebsiteResearchPolicyError("Website URL is invalid."); }
  if (url.protocol !== "https:") throw new WebsiteResearchPolicyError("Only HTTPS website research is allowed.");
  if (url.username || url.password || url.hash) throw new WebsiteResearchPolicyError("Website URL credentials and fragments are not allowed.");
  if (url.port && url.port !== "443") throw new WebsiteResearchPolicyError("Only the standard HTTPS port is allowed.");
  if (!url.hostname || isNumericHostAlias(url.hostname)) throw new WebsiteResearchPolicyError("Website hostname is not allowed.");
  return canonicalizeUrl(url);
}

async function requestWithRedirects(
  initial: URL, canonicalHost: string, robots: boolean, transport: ResearchTransport,
  limits: typeof WEBSITE_RESEARCH_LIMITS, now: () => Date, started: Date,
): Promise<{ url: URL; response: ResearchHttpResponse; canonicalHost: string }> {
  let url = canonicalizeUrl(initial);
  let establishedHost = canonicalHost;
  for (let redirect = 0; redirect <= limits.maxRedirects; redirect++) {
    if (elapsedMs(now, started) >= limits.maxRunMs) throw new WebsiteResearchPolicyError("The research time limit was reached.");
    assertAllowedTarget(url, establishedHost, redirect === 0);
    const addresses = await transport.resolve(url.hostname);
    const pinnedAddress = validateResolvedAddresses(addresses);
    const response = await transport.fetch({
      url, pinnedAddress, timeoutMs: limits.maxRequestMs,
      maxBodyBytes: robots ? limits.maxRobotsBytes : limits.maxBodyBytes, userAgent: limits.userAgent,
    });
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirect === limits.maxRedirects) throw new WebsiteResearchPolicyError("The redirect limit was reached.");
      let destination: URL;
      try { destination = canonicalizeUrl(new URL(location, url)); } catch { throw new WebsiteResearchPolicyError("The redirect target is invalid."); }
      if (destination.protocol !== "https:" || destination.username || destination.password || destination.port && destination.port !== "443") {
        throw new WebsiteResearchPolicyError("The redirect target violates the HTTPS policy.");
      }
      if (destination.hostname !== establishedHost) {
        if (redirect === 0 && isWwwPair(destination.hostname, establishedHost)) establishedHost = destination.hostname;
        else throw new WebsiteResearchPolicyError("Cross-host redirects are not allowed.");
      }
      url = destination;
      continue;
    }
    return { url, response, canonicalHost: establishedHost };
  }
  throw new WebsiteResearchPolicyError("The redirect limit was reached.");
}

function assertAllowedTarget(url: URL, canonicalHost: string, allowInitialHost: boolean): void {
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443") {
    throw new WebsiteResearchPolicyError("The website target violates the HTTPS policy.");
  }
  if (!allowInitialHost && url.hostname !== canonicalHost) throw new WebsiteResearchPolicyError("The website target is outside the canonical hostname.");
  if (!url.hostname || isNumericHostAlias(url.hostname)) throw new WebsiteResearchPolicyError("The website hostname is not allowed.");
}

function validateResolvedAddresses(addresses: readonly string[]): string {
  if (addresses.length === 0) throw new WebsiteResearchPolicyError("The website hostname did not resolve.");
  const unique = [...new Set(addresses.map((address) => address.toLowerCase()))].sort();
  if (unique.some((address) => !isPublicAddress(address))) throw new WebsiteResearchPolicyError("The website hostname resolved to a prohibited network address.");
  return unique[0];
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const normalized = address.toLowerCase();
  const mapped = normalized.match(/^(?:0*:){5}ffff:([0-9.]+)$/);
  if (mapped) return isPublicIpv4(mapped[1]);
  try {
    const value = ipv6ToBigInt(normalized);
    const prefix = (bits: number) => value >> BigInt(128 - bits);
    if (value === 0n || value === 1n || prefix(8) === 0xffn) return false;
    if (prefix(7) === 0x7en || prefix(10) === 0x3fan) return false; // fc00::/7 and fe80::/10
    if (prefix(32) === 0x20010db8n) return false; // documentation range
    return true;
  } catch { return false; }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168 || (b === 0 && c === 2) || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6ToBigInt(input: string): bigint {
  const [leftRaw, rightRaw = ""] = input.split("::");
  if (input.split("::").length > 2) throw new Error("Invalid IPv6");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) throw new Error("Invalid IPv6");
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  if (parts.length !== 8) throw new Error("Invalid IPv6");
  return parts.reduce((value, part) => {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) throw new Error("Invalid IPv6");
    return (value << 16n) + BigInt(`0x${part}`);
  }, 0n);
}

function isNumericHostAlias(host: string): boolean {
  return net.isIP(host) !== 0 || /^[0-9]+$/.test(host) || /^0x[0-9a-f]+$/i.test(host) || /^0[0-7.]+$/.test(host);
}

function isWwwPair(a: string, b: string): boolean {
  return a === `www.${b}` || b === `www.${a}`;
}

function canonicalizeUrl(url: URL): URL {
  const copy = new URL(url.toString());
  copy.hash = "";
  copy.hostname = copy.hostname.toLowerCase();
  for (const key of [...copy.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) copy.searchParams.delete(key);
  return copy;
}

function canonicalPageKey(url: URL): string { return canonicalizeUrl(url).toString(); }
function elapsedMs(now: () => Date, started: Date): number { return Math.max(0, now().getTime() - started.getTime()); }
function isHtml(contentType?: string): boolean { return /^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType ?? ""); }
function isPlainText(contentType?: string): boolean { return /^text\/plain(?:;|$)/i.test(contentType ?? ""); }

function isAllowedByRobots(text: string, path: string, userAgent: string): boolean {
  const groups: { agents: string[]; disallow: string[] }[] = [];
  let group: { agents: string[]; disallow: string[] } = { agents: [], disallow: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!match) continue;
    const key = match[1].toLowerCase(); const value = match[2].trim();
    if (key === "user-agent") { if (group.disallow.length) { groups.push(group); group = { agents: [], disallow: [] }; } group.agents.push(value.toLowerCase()); }
    else if (key === "disallow" && group.agents.length) group.disallow.push(value);
  }
  if (group.agents.length) groups.push(group);
  const agent = userAgent.toLowerCase();
  const applicable = groups.filter((item) => item.agents.some((value) => value === "*" || agent.startsWith(value)));
  return !applicable.some((item) => item.disallow.some((rule) => rule !== "" && path.startsWith(rule)));
}

function validateRobotsText(text: string): void {
  if (text.includes("\0")) throw new WebsiteResearchPolicyError("robots.txt was malformed.");
}

function selectResearchLinks(base: URL, html: string, canonicalHost: string): URL[] {
  const links: URL[] = [];
  const regex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(regex)) {
    try {
      const url = canonicalizeUrl(new URL(match[1], base));
      if (url.protocol !== "https:" || url.hostname !== canonicalHost || url.username || url.password || url.port && url.port !== "443") continue;
      if (!/(accommodation|room|stay|amenit|facilit|gallery|about|property|contact|tour|experience)/i.test(url.pathname)) continue;
      links.push(url);
    } catch { /* Untrusted invalid links are ignored. */ }
  }
  const seen = new Set<string>();
  return links.sort((a, b) => a.toString().localeCompare(b.toString())).filter((url) => !seen.has(canonicalPageKey(url)) && !!seen.add(canonicalPageKey(url)));
}

function extractEvidence(url: URL, html: string, captured: Date, maximum: number): ResearchEvidenceDraft[] {
  const title = extractTitle(html);
  const text = boundedText(stripHtml(html), maximum);
  const found: Omit<ResearchEvidenceDraft, "content_hash">[] = [];
  const add = (type: WebsiteObservationType, claim: string, observation: string) => found.push({
    source_type: "WEBSITE", source_url: url.toString(), page_title: title, observation_type: type,
    claim, observation: boundedText(observation, maximum), captured_at: captured.toISOString(),
  });
  add("PAGE_METADATA", "The fetched page supplied page metadata.", `Title: ${title ?? "(no title)"}. URL path: ${url.pathname}.`);
  const lower = `${url.pathname} ${html}`.toLowerCase();
  if (/gallery|photo gallery|image gallery/.test(lower)) add("GALLERY", "The fetched page contained a gallery marker.", `Gallery-related marker observed on ${url.pathname}.`);
  if (/accommodation|guest room|bedroom|suite|villa|stay/.test(lower)) add("ACCOMMODATION", "The fetched page contained accommodation-related content.", `Accommodation-related marker observed on ${url.pathname}.`);
  if (/amenit|facilit|pool|spa|restaurant/.test(lower)) add("AMENITY", "The fetched page contained amenity-related content.", `Amenity-related marker observed on ${url.pathname}.`);
  const mail = html.match(/mailto:([^"'\s>?]+)/i); const phone = html.match(/tel:([^"'\s>?]+)/i);
  if (mail || phone || /contact\s*(us|information)?/i.test(text)) add("CONTACT", "The fetched page contained contact-related content.", mail ? `Observed email link: ${decodeHtml(mail[1])}.` : phone ? `Observed telephone link: ${decodeHtml(phone[1])}.` : `Contact marker observed on ${url.pathname}.`);
  if (/matterport\.com/i.test(html)) add("MATTERPORT_EMBED", "The fetched page contained a Matterport reference.", `Matterport URL or embed marker observed on ${url.pathname}.`);
  if (/(virtual tour|360(?:°|&deg;)|panorama|interactive tour)/i.test(html)) add("INTERACTIVE_EXPERIENCE", "The fetched page contained an interactive-experience marker.", `Interactive-experience marker observed on ${url.pathname}.`);
  if (/(youtube\.com|youtu\.be|vimeo\.com|<video\b)/i.test(html)) add("VIDEO_EMBED", "The fetched page contained a video marker.", `Video URL or video element observed on ${url.pathname}.`);
  if (/(google\.com\/maps|streetview|street view)/i.test(html)) add("STREET_VIEW_EMBED", "The fetched page contained a street-view marker.", `Street-view marker observed on ${url.pathname}.`);
  if (/(floor ?plan|floorplan)/i.test(html)) add("FLOORPLAN_MARKER", "The fetched page contained a floorplan marker.", `Floorplan marker observed on ${url.pathname}.`);
  return found.map((item) => ({ ...item, content_hash: contentHash(item) }));
}

function extractTitle(html: string): string | null { const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match ? boundedText(decodeHtml(stripHtml(match[1])), 500) || null : null; }
function stripHtml(html: string): string { return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); }
function decodeHtml(value: string): string { return value.replace(/&(?:amp|#38);/gi, "&").replace(/&(?:lt|#60);/gi, "<").replace(/&(?:gt|#62);/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
function boundedText(value: string, maximum: number): string { return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum); }
function contentHash(item: Omit<ResearchEvidenceDraft, "content_hash">): string { return createHash("sha256").update(JSON.stringify({ source_url: item.source_url, page_title: item.page_title, observation_type: item.observation_type, claim: item.claim, observation: item.observation })).digest("hex"); }
