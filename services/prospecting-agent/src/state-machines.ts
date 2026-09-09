import type { MissionStatus, ProspectStatus } from "./vocabulary.ts";

export const PROSPECT_TRANSITIONS: Readonly<Record<ProspectStatus, readonly ProspectStatus[]>> = Object.freeze({
  DISCOVERED: ["RESEARCHING"],
  RESEARCHING: ["INSUFFICIENT_EVIDENCE", "DISQUALIFIED", "QUALIFIED", "FAILED"],
  INSUFFICIENT_EVIDENCE: ["RESEARCHING"],
  DISQUALIFIED: ["RESEARCHING"],
  QUALIFIED: ["PENDING_APPROVAL", "RESEARCHING"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "RESEARCHING"],
  APPROVED: ["PROMOTED_TO_STUDIO", "RESEARCHING"],
  REJECTED: ["RESEARCHING"],
  PROMOTED_TO_STUDIO: [],
  FAILED: ["RESEARCHING"],
});

export const MISSION_TRANSITIONS: Readonly<Record<MissionStatus, readonly MissionStatus[]>> = Object.freeze({
  DRAFT: ["READY", "CANCELLED"],
  READY: ["RUNNING", "CANCELLED", "FAILED"],
  RUNNING: ["PAUSED", "COMPLETED", "CANCELLED", "FAILED", "BUDGET_EXHAUSTED"],
  PAUSED: ["READY", "RUNNING", "CANCELLED", "FAILED", "BUDGET_EXHAUSTED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ["READY"],
  BUDGET_EXHAUSTED: ["READY", "CANCELLED"],
});

export function canTransitionProspect(from: ProspectStatus, to: ProspectStatus): boolean {
  return PROSPECT_TRANSITIONS[from].includes(to);
}

export function assertProspectTransition(from: ProspectStatus, to: ProspectStatus): void {
  if (!canTransitionProspect(from, to)) throw new Error(`Invalid prospect transition: ${from} -> ${to}.`);
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) throw new Error(`Invalid mission transition: ${from} -> ${to}.`);
}
