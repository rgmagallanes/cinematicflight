import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../public/api/index.php", import.meta.url), "utf8");
const setupGuide = await readFile(new URL("../HOSTINGER-MYSQL.md", import.meta.url), "utf8");
const configExample = await readFile(new URL("../public/api/config.example.php", import.meta.url), "utf8");
const ingestSource = await readFile(new URL("../public/api/review-ingest.php", import.meta.url), "utf8");

test("production API prefers an account-level private configuration", () => {
  const environmentOverride = apiSource.indexOf("CINEMATIC_FLIGHT_CONFIG_PATH");
  const accountPrivate = apiSource.indexOf("$homeDirectory . '/cinematic-flight-private/config.php'");
  const domainFallback = apiSource.indexOf("dirname(__DIR__, 2) . '/cinematic-flight-private/config.php'");
  const publicFallback = apiSource.indexOf("__DIR__ . '/config.php'");

  assert.ok(environmentOverride >= 0);
  assert.ok(accountPrivate > environmentOverride);
  assert.ok(domainFallback > accountPrivate);
  assert.ok(publicFallback > domainFallback);
});

test("setup guide keeps configuration above the managed domains directory", () => {
  assert.match(setupGuide, /hosting-account level/);
  assert.match(setupGuide, /beside `domains`/);
  assert.match(setupGuide, /DO_NOT_UPLOAD_HERE/);
  assert.match(setupGuide, /\/home\/YOUR_HOSTINGER_USERNAME\/cinematic-flight-private\/config\.php/);
});

test("production review ingestion is separately disabled and import-only", () => {
  assert.match(configExample, /'review_import_enabled' => false/);
  assert.match(configExample, /'review_import_token' => ''/);
  assert.match(configExample, /'review_import_owner_email' => ''/);
  assert.match(configExample, /'review_import_inquiry_id' => ''/);
  assert.match(configExample, /'review_import_uid' => 0/);
  assert.match(ingestSource, /\^\[a-f0-9\]\{64\}\$\/D/);
  assert.match(ingestSource, /savedToProductionReview/);
  assert.match(ingestSource, /'sendingEnabled' => false/);
  assert.doesNotMatch(ingestSource, /review_change|review_find|review_attachment/);
});
