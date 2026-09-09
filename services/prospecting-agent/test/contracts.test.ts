import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const contractDirectory = new URL("../../../contracts/prospecting/", import.meta.url);

test("all Phase 1 contracts are valid JSON Schema documents with unique IDs", async () => {
  const files = (await readdir(contractDirectory)).filter((file) => file.endsWith(".schema.json")).sort();
  assert.deepEqual(files, [
    "agent-decision.schema.json", "agent-run.schema.json", "approval.schema.json", "artifact.schema.json",
    "common.schema.json", "contact.schema.json", "cost-event.schema.json", "evidence.schema.json",
    "mission-prospect.schema.json", "mission.schema.json", "promotion.schema.json", "prospect.schema.json",
    "qualification.schema.json", "website-research.schema.json",
  ]);

  const ids = new Set<string>();
  for (const file of files) {
    const schema = JSON.parse(await readFile(new URL(file, contractDirectory), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", file);
    assert.equal(typeof schema.$id, "string", file);
    assert.equal(ids.has(schema.$id), false, `duplicate schema ID: ${schema.$id}`);
    ids.add(schema.$id);
    if (file !== "common.schema.json") {
      assert.equal(schema.type, "object", file);
      assert.equal(schema.additionalProperties, false, file);
      assert.ok(Array.isArray(schema.required) && schema.required.length > 0, file);
    }
  }
});

test("contract-level money and outreach constraints remain deterministic", async () => {
  const common = JSON.parse(await readFile(new URL("common.schema.json", contractDirectory), "utf8"));
  assert.equal(common.$defs.centavos.type, "integer");
  assert.equal(common.$defs.centavos.minimum, 0);

  const artifact = JSON.parse(await readFile(new URL("artifact.schema.json", contractDirectory), "utf8"));
  assert.equal(artifact.properties.delivery_status.const, "INTERNAL_UNSENT");

  const decision = JSON.parse(await readFile(new URL("agent-decision.schema.json", contractDirectory), "utf8"));
  assert.equal(decision.properties.action.enum.includes("SEND_EMAIL"), false);
  assert.equal(decision.properties.action.enum.includes("PROMOTE_TO_STUDIO"), false);
  assert.equal(decision.properties.action.enum.includes("SAVE_EVIDENCE"), true);
  assert.equal(decision.properties.action.enum.includes("SAVE_PROSPECT"), true);
  assert.equal(decision.properties.action.enum.includes("STOP_REPEATED_ACTION"), true);
  assert.equal(decision.properties.action.enum.includes("STOP_TOOL_FAILURE"), true);
  assert.equal(decision.properties.action.enum.includes("STOP_RESEARCH_COMPLETE"), true);

  const run = JSON.parse(await readFile(new URL("agent-run.schema.json", contractDirectory), "utf8"));
  assert.equal(run.properties.stop_reason.enum.includes("PAGE_LIMIT"), true);
  assert.equal(run.properties.stop_reason.enum.includes("LLM_LIMIT"), true);
  assert.equal(run.properties.stop_reason.enum.includes("REPEATED_ACTION"), true);
  assert.equal(run.properties.stop_reason.enum.includes("RESEARCH_COMPLETE"), true);
  assert.equal(run.properties.stop_reason.enum.includes("POLICY_BLOCKED"), true);

  const research = JSON.parse(await readFile(new URL("website-research.schema.json", contractDirectory), "utf8"));
  assert.equal(research.properties.status.enum.includes("COMPLETED"), true);
  assert.equal(research.properties.stop_reason.enum.includes("RESEARCH_COMPLETE"), true);
});
