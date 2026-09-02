import { assertValidCentavoAmount } from "./validation.ts";

export const DEFAULT_MONTHLY_BUDGET_CENTAVOS = 200_000;

export type BudgetDecisionCode = "ALLOW" | "ALLOW_FREE" | "DENY_BUDGET";

export interface BudgetPolicyInput {
  mission_budget_centavos: number;
  mission_spent_centavos: number;
  mission_reserved_centavos?: number;
  reserved_centavos?: number;
  monthly_budget_centavos?: number;
  monthly_spent_centavos?: number;
  monthly_reserved_centavos?: number;
  estimated_operation_cost_centavos: number;
}

export interface BudgetDecision {
  allowed: boolean;
  decision: BudgetDecisionCode;
  reason: string;
  mission_available_centavos: number;
  monthly_available_centavos: number;
}

export interface CostReservation {
  id: string;
  estimated_cost_centavos: number;
}

export interface BudgetLedgerState {
  mission_budget_centavos: number;
  mission_spent_centavos: number;
  monthly_budget_centavos: number;
  monthly_spent_centavos: number;
  reservations: readonly CostReservation[];
}

export interface ReservationResult {
  allowed: boolean;
  decision: BudgetDecisionCode | "DENY_DUPLICATE_RESERVATION";
  reason: string;
  state: BudgetLedgerState;
  reservation: CostReservation | null;
}

export interface CommitResult {
  allowed: boolean;
  decision: "COMMIT" | "DENY_UNKNOWN_RESERVATION" | "DENY_OVERAGE";
  reason: string;
  state: BudgetLedgerState;
  committed_cost_centavos: number;
  released_centavos: number;
  requires_reconciliation: boolean;
}

export interface ReleaseResult {
  released: boolean;
  state: BudgetLedgerState;
  released_centavos: number;
}

export function evaluateBudget(input: BudgetPolicyInput): BudgetDecision {
  const missionReserved = input.mission_reserved_centavos ?? input.reserved_centavos ?? 0;
  const monthlyBudget = input.monthly_budget_centavos ?? DEFAULT_MONTHLY_BUDGET_CENTAVOS;
  const monthlySpent = input.monthly_spent_centavos ?? 0;
  const monthlyReserved = input.monthly_reserved_centavos ?? missionReserved;

  validateBudgetFields({
    mission_budget_centavos: input.mission_budget_centavos,
    mission_spent_centavos: input.mission_spent_centavos,
    mission_reserved_centavos: missionReserved,
    monthly_budget_centavos: monthlyBudget,
    monthly_spent_centavos: monthlySpent,
    monthly_reserved_centavos: monthlyReserved,
    estimated_operation_cost_centavos: input.estimated_operation_cost_centavos,
  });

  const missionAvailable = Math.max(0, input.mission_budget_centavos - input.mission_spent_centavos - missionReserved);
  const monthlyAvailable = Math.max(0, monthlyBudget - monthlySpent - monthlyReserved);
  const estimate = input.estimated_operation_cost_centavos;

  if (estimate === 0) {
    return {
      allowed: true,
      decision: "ALLOW_FREE",
      reason: "Free operations do not consume mission or monthly budget.",
      mission_available_centavos: missionAvailable,
      monthly_available_centavos: monthlyAvailable,
    };
  }
  if (estimate > missionAvailable) {
    return {
      allowed: false,
      decision: "DENY_BUDGET",
      reason: "The estimated operation cost exceeds the available mission budget.",
      mission_available_centavos: missionAvailable,
      monthly_available_centavos: monthlyAvailable,
    };
  }
  if (estimate > monthlyAvailable) {
    return {
      allowed: false,
      decision: "DENY_BUDGET",
      reason: "The estimated operation cost exceeds the available monthly budget.",
      mission_available_centavos: missionAvailable,
      monthly_available_centavos: monthlyAvailable,
    };
  }
  return {
    allowed: true,
    decision: "ALLOW",
    reason: "The estimated operation cost fits both mission and monthly budgets.",
    mission_available_centavos: missionAvailable,
    monthly_available_centavos: monthlyAvailable,
  };
}

export function createBudgetLedger(input: Omit<BudgetLedgerState, "reservations"> & { reservations?: readonly CostReservation[] }): BudgetLedgerState {
  const state: BudgetLedgerState = { ...input, reservations: [...(input.reservations ?? [])] };
  validateLedger(state);
  return state;
}

export function reservedCentavos(state: BudgetLedgerState): number {
  return state.reservations.reduce((sum, reservation) => sum + reservation.estimated_cost_centavos, 0);
}

export function reserveCost(state: BudgetLedgerState, reservationId: string, estimatedCostCentavos: number): ReservationResult {
  validateLedger(state);
  assertReservationId(reservationId);
  assertValidCentavoAmount(estimatedCostCentavos, "estimatedCostCentavos");
  if (state.reservations.some(({ id }) => id === reservationId)) {
    return {
      allowed: false,
      decision: "DENY_DUPLICATE_RESERVATION",
      reason: `Reservation ${reservationId} already exists.`,
      state,
      reservation: null,
    };
  }

  const budget = evaluateBudget({
    mission_budget_centavos: state.mission_budget_centavos,
    mission_spent_centavos: state.mission_spent_centavos,
    mission_reserved_centavos: reservedCentavos(state),
    monthly_budget_centavos: state.monthly_budget_centavos,
    monthly_spent_centavos: state.monthly_spent_centavos,
    monthly_reserved_centavos: reservedCentavos(state),
    estimated_operation_cost_centavos: estimatedCostCentavos,
  });
  if (!budget.allowed || estimatedCostCentavos === 0) {
    return {
      allowed: budget.allowed,
      decision: budget.decision,
      reason: budget.reason,
      state,
      reservation: null,
    };
  }

  const reservation = { id: reservationId, estimated_cost_centavos: estimatedCostCentavos };
  return {
    allowed: true,
    decision: "ALLOW",
    reason: "Cost reserved against both mission and monthly ceilings.",
    state: { ...state, reservations: [...state.reservations, reservation] },
    reservation,
  };
}

export function commitCost(state: BudgetLedgerState, reservationId: string, actualCostCentavos: number): CommitResult {
  validateLedger(state);
  assertReservationId(reservationId);
  assertValidCentavoAmount(actualCostCentavos, "actualCostCentavos");
  const reservation = state.reservations.find(({ id }) => id === reservationId);
  if (!reservation) {
    return {
      allowed: false,
      decision: "DENY_UNKNOWN_RESERVATION",
      reason: `Reservation ${reservationId} does not exist.`,
      state,
      committed_cost_centavos: 0,
      released_centavos: 0,
      requires_reconciliation: false,
    };
  }

  const otherReserved = reservedCentavos(state) - reservation.estimated_cost_centavos;
  const missionWouldFit = state.mission_spent_centavos + otherReserved + actualCostCentavos <= state.mission_budget_centavos;
  const monthlyWouldFit = state.monthly_spent_centavos + otherReserved + actualCostCentavos <= state.monthly_budget_centavos;
  if (!missionWouldFit || !monthlyWouldFit) {
    return {
      allowed: false,
      decision: "DENY_OVERAGE",
      reason: "Actual cost cannot be committed without exceeding a budget ceiling; the reservation remains held for reconciliation.",
      state,
      committed_cost_centavos: 0,
      released_centavos: 0,
      requires_reconciliation: true,
    };
  }

  const released = Math.max(0, reservation.estimated_cost_centavos - actualCostCentavos);
  return {
    allowed: true,
    decision: "COMMIT",
    reason: actualCostCentavos > reservation.estimated_cost_centavos
      ? "Actual cost exceeded its estimate but still fits both budget ceilings."
      : "Actual cost committed and unused reservation released.",
    state: {
      ...state,
      mission_spent_centavos: state.mission_spent_centavos + actualCostCentavos,
      monthly_spent_centavos: state.monthly_spent_centavos + actualCostCentavos,
      reservations: state.reservations.filter(({ id }) => id !== reservationId),
    },
    committed_cost_centavos: actualCostCentavos,
    released_centavos: released,
    requires_reconciliation: false,
  };
}

export function releaseReservation(state: BudgetLedgerState, reservationId: string): ReleaseResult {
  validateLedger(state);
  assertReservationId(reservationId);
  const reservation = state.reservations.find(({ id }) => id === reservationId);
  if (!reservation) return { released: false, state, released_centavos: 0 };
  return {
    released: true,
    state: { ...state, reservations: state.reservations.filter(({ id }) => id !== reservationId) },
    released_centavos: reservation.estimated_cost_centavos,
  };
}

function validateLedger(state: BudgetLedgerState): void {
  const totalReserved = reservedCentavosUnchecked(state.reservations);
  validateBudgetFields({
    mission_budget_centavos: state.mission_budget_centavos,
    mission_spent_centavos: state.mission_spent_centavos,
    mission_reserved_centavos: totalReserved,
    monthly_budget_centavos: state.monthly_budget_centavos,
    monthly_spent_centavos: state.monthly_spent_centavos,
    monthly_reserved_centavos: totalReserved,
    estimated_operation_cost_centavos: 0,
  });
  const ids = new Set<string>();
  for (const reservation of state.reservations) {
    assertReservationId(reservation.id);
    assertValidCentavoAmount(reservation.estimated_cost_centavos, "reservation.estimated_cost_centavos");
    if (ids.has(reservation.id)) throw new Error(`Duplicate reservation id: ${reservation.id}.`);
    ids.add(reservation.id);
  }
  if (state.mission_spent_centavos + totalReserved > state.mission_budget_centavos) {
    throw new RangeError("Mission spent and reserved cost exceeds the mission budget.");
  }
  if (state.monthly_spent_centavos + totalReserved > state.monthly_budget_centavos) {
    throw new RangeError("Monthly spent and reserved cost exceeds the monthly budget.");
  }
}

function validateBudgetFields(fields: Record<string, number>): void {
  for (const [field, value] of Object.entries(fields)) assertValidCentavoAmount(value, field);
}

function reservedCentavosUnchecked(reservations: readonly CostReservation[]): number {
  return reservations.reduce((sum, reservation) => sum + reservation.estimated_cost_centavos, 0);
}

function assertReservationId(value: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError("reservationId must be a non-empty string.");
}
