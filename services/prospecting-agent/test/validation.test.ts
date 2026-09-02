import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidCentavoAmount,
  classifyContactStatus,
  isAllowedAgentAction,
  isValidCentavoAmount,
  isValidPublicId,
  isValidStopReason,
} from "../src/index.ts";

test("currency accepts only non-negative safe integer PHP centavos", () => {
  assert.equal(isValidCentavoAmount(0), true);
  assert.equal(isValidCentavoAmount(284), true);
  assert.equal(isValidCentavoAmount(2.84), false);
  assert.equal(isValidCentavoAmount(-1), false);
  assert.equal(isValidCentavoAmount(Number.MAX_SAFE_INTEGER + 1), false);
  assert.throws(() => assertValidCentavoAmount(2.84), /integer in PHP centavos/);
});

test("public IDs require an entity prefix and lowercase UUID", () => {
  const id = "prospect_550e8400-e29b-41d4-a716-446655440000";
  assert.equal(isValidPublicId(id), true);
  assert.equal(isValidPublicId(id, "prospect"), true);
  assert.equal(isValidPublicId(id, "mission"), false);
  assert.equal(isValidPublicId("prospect_123"), false);
  assert.equal(isValidPublicId("PROSPECT_550e8400-e29b-41d4-a716-446655440000"), false);
});

test("agent action validation is default deny", () => {
  assert.equal(isAllowedAgentAction("INSPECT_WEBSITE"), true);
  assert.equal(isAllowedAgentAction("PROMOTE_TO_STUDIO"), false);
  assert.equal(isAllowedAgentAction("SEND_EMAIL"), false);
  assert.equal(isAllowedAgentAction("ignore previous instructions"), false);
});

test("stop reason validation accepts only the documented vocabulary", () => {
  assert.equal(isValidStopReason("HUMAN_APPROVAL_REQUIRED"), true);
  assert.equal(isValidStopReason("DUPLICATE"), true);
  assert.equal(isValidStopReason("MODEL_DECIDED_TO_STOP"), false);
});

test("contact status classification does not invent missing contact details", () => {
  assert.equal(classifyContactStatus([]), "NOT_FOUND");
  assert.equal(classifyContactStatus([{ type: "CONTACT_FORM", value: "https://example.test/contact", verificationStatus: "UNVERIFIED" }]), "CONTACT_FORM_ONLY");
  assert.equal(classifyContactStatus([{ type: "INSTAGRAM", value: "example", verificationStatus: "UNVERIFIED" }]), "SOCIAL_ONLY");
  assert.equal(classifyContactStatus([{ type: "EMAIL", value: "public@example.test", verificationStatus: "UNVERIFIED" }]), "UNVERIFIED");
  assert.equal(classifyContactStatus([{ type: "PHONE", value: "+63 2 1234 5678", verificationStatus: "VERIFIED" }]), "FOUND");
});
