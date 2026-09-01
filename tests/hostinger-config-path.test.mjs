import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../public/api/index.php", import.meta.url), "utf8");
const setupGuide = await readFile(new URL("../HOSTINGER-MYSQL.md", import.meta.url), "utf8");

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
