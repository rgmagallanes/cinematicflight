import { apiGet, apiPatch, apiPost } from './hostingerApi.js';

export const MISSION_TRANSITIONS = {
  DRAFT: ['READY', 'CANCELLED'], READY: ['RUNNING', 'CANCELLED', 'FAILED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED', 'BUDGET_EXHAUSTED'],
  PAUSED: ['READY', 'RUNNING', 'CANCELLED', 'FAILED', 'BUDGET_EXHAUSTED'],
  FAILED: ['READY'], BUDGET_EXHAUSTED: ['READY', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};

const data = (payload) => {
  if (!payload || !Array.isArray(payload.data)) throw new Error('The Prospecting API returned an invalid response.');
  return payload.data;
};

const record = (payload, key) => {
  if (!payload || !payload[key] || typeof payload[key] !== 'object') throw new Error('The Prospecting API returned an invalid response.');
  return payload[key];
};

export const prospectingApi = {
  listMissions: async () => data(await apiGet('prospecting-missions')),
  getMission: async (id) => record(await apiGet('prospecting-missions', { id }), 'mission'),
  createMission: async (payload) => record(await apiPost('prospecting-missions', payload), 'mission'),
  updateMission: async (id, payload) => record(await apiPatch('prospecting-missions', payload, { id }), 'mission'),
  listMissionProspects: async (missionId) => data(await apiGet('prospecting-mission-prospects', { mission_id: missionId })),
  addMissionProspect: async (missionId, prospectId) => apiPost('prospecting-mission-prospects', { prospect_public_id: prospectId, discovery_source: 'MANUAL', mission_status: 'ACTIVE' }, { mission_id: missionId }),

  listProspects: async () => data(await apiGet('prospecting-prospects')),
  getProspect: async (id) => record(await apiGet('prospecting-prospects', { id }), 'prospect'),
  createProspect: async (payload) => record(await apiPost('prospecting-prospects', payload), 'prospect'),
  updateProspect: async (id, payload) => record(await apiPatch('prospecting-prospects', payload, { id }), 'prospect'),
  listEvidence: async (prospectId) => data(await apiGet('prospecting-evidence', { prospect_id: prospectId })),
  listContacts: async (prospectId) => data(await apiGet('prospecting-contacts', { prospect_id: prospectId })),
  listQualifications: async (prospectId) => data(await apiGet('prospecting-qualifications', { prospect_id: prospectId })),
  listApprovals: async (prospectId) => data(await apiGet('prospecting-approvals', { prospect_id: prospectId })),
  createApproval: async (prospectId, payload) => record(await apiPost('prospecting-approvals', payload, { prospect_id: prospectId }), 'approval'),
  listArtifacts: async (prospectId) => data(await apiGet('prospecting-artifacts', { prospect_id: prospectId })),

  listRuns: async (params = {}) => data(await apiGet('prospecting-runs', params)),
  listDecisions: async (runId) => data(await apiGet('prospecting-decisions', { run_id: runId })),
  listReservations: async (params = {}) => data(await apiGet('prospecting-reservations', params)),
  getMissionCosts: async (missionId) => record(await apiGet('prospecting-costs', { mission_id: missionId }), 'summary'),
  listWebsiteResearchRequests: async (params = {}) => data(await apiGet('prospecting-website-research-requests', params)),
  createWebsiteResearchRequest: async (payload) => record(await apiPost('prospecting-website-research-requests', payload), 'request'),
  cancelWebsiteResearchRequest: async (id) => record(await apiPatch('prospecting-website-research-requests', { status: 'CANCELLED' }, { id }), 'request'),
};

export function parsePhpToCentavos(value) {
  const normalized = String(value ?? '').trim().replaceAll(',', '');
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const centavos = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
  return centavos <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(centavos) : null;
}

export function formatPhpCentavos(value) {
  if (!Number.isSafeInteger(value)) return '—';
  const negative = value < 0; const amount = BigInt(negative ? -value : value);
  const whole = (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (amount % 100n).toString().padStart(2, '0');
  return `${negative ? '−' : ''}₱${whole}.${fraction}`;
}
