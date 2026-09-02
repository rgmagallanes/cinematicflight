import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MONTHLY_BUDGET_CENTAVOS,
  commitCost,
  createBudgetLedger,
  evaluateBudget,
  releaseReservation,
  reserveCost,
  reservedCentavos,
} from "../src/index.ts";

const budget = (estimate: number, overrides = {}) => evaluateBudget({
  mission_budget_centavos: 10_000,
  mission_spent_centavos: 7_200,
  mission_reserved_centavos: 1_000,
  monthly_budget_centavos: 200_000,
  monthly_spent_centavos: 20_000,
  monthly_reserved_centavos: 1_000,
  estimated_operation_cost_centavos: estimate,
  ...overrides,
});

test("free tools are allowed with zero mission and monthly budget", () => {
  const result = budget(0, { mission_budget_centavos: 0, mission_spent_centavos: 0, mission_reserved_centavos: 0, monthly_budget_centavos: 0, monthly_spent_centavos: 0, monthly_reserved_centavos: 0 });
  assert.equal(result.decision, "ALLOW_FREE");
});

test("paid tools are allowed inside and exactly at the remaining mission budget", () => {
  assert.equal(budget(1_799).decision, "ALLOW");
  assert.equal(budget(1_800).decision, "ALLOW");
  assert.equal(budget(2_500).decision, "DENY_BUDGET");
});

test("monthly budget is a second mandatory ceiling and defaults to PHP 2000", () => {
  assert.equal(DEFAULT_MONTHLY_BUDGET_CENTAVOS, 200_000);
  assert.equal(budget(1_000, { monthly_budget_centavos: 21_500 }).decision, "DENY_BUDGET");
});

test("reservation reduces availability and release restores it", () => {
  const initial = createBudgetLedger({
    mission_budget_centavos: 1_000,
    mission_spent_centavos: 0,
    monthly_budget_centavos: 2_000,
    monthly_spent_centavos: 0,
  });
  const reserved = reserveCost(initial, "operation-1", 700);
  assert.equal(reserved.allowed, true);
  assert.equal(reservedCentavos(reserved.state), 700);
  assert.equal(reserveCost(reserved.state, "operation-2", 301).decision, "DENY_BUDGET");
  const released = releaseReservation(reserved.state, "operation-1");
  assert.equal(released.released_centavos, 700);
  assert.equal(reserveCost(released.state, "operation-2", 1_000).allowed, true);
});

test("commit records actual cost and releases unused estimate", () => {
  const initial = createBudgetLedger({ mission_budget_centavos: 1_000, mission_spent_centavos: 100, monthly_budget_centavos: 2_000, monthly_spent_centavos: 200 });
  const reserved = reserveCost(initial, "operation-1", 400);
  const committed = commitCost(reserved.state, "operation-1", 250);
  assert.equal(committed.decision, "COMMIT");
  assert.equal(committed.state.mission_spent_centavos, 350);
  assert.equal(committed.state.monthly_spent_centavos, 450);
  assert.equal(committed.released_centavos, 150);
  assert.equal(reservedCentavos(committed.state), 0);
});

test("actual cost above estimate commits only when both ceilings still fit", () => {
  const initial = createBudgetLedger({ mission_budget_centavos: 1_000, mission_spent_centavos: 0, monthly_budget_centavos: 1_000, monthly_spent_centavos: 0 });
  const reserved = reserveCost(initial, "operation-1", 400);
  const committed = commitCost(reserved.state, "operation-1", 500);
  assert.equal(committed.decision, "COMMIT");
  assert.equal(committed.state.mission_spent_centavos, 500);

  const tight = createBudgetLedger({ mission_budget_centavos: 500, mission_spent_centavos: 0, monthly_budget_centavos: 500, monthly_spent_centavos: 0 });
  const tightReservation = reserveCost(tight, "operation-2", 400);
  const denied = commitCost(tightReservation.state, "operation-2", 501);
  assert.equal(denied.decision, "DENY_OVERAGE");
  assert.equal(denied.requires_reconciliation, true);
  assert.equal(reservedCentavos(denied.state), 400);
});

test("negative and floating-point currency values are rejected", () => {
  assert.throws(() => budget(-1), /non-negative safe integer/);
  assert.throws(() => budget(2.5), /non-negative safe integer/);
  const state = createBudgetLedger({ mission_budget_centavos: 1_000, mission_spent_centavos: 0, monthly_budget_centavos: 1_000, monthly_spent_centavos: 0 });
  assert.throws(() => reserveCost(state, "bad", 1.2), /non-negative safe integer/);
});
