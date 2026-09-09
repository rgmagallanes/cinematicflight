import test from 'node:test';
import assert from 'node:assert/strict';

test('prospecting client centralizes same-origin reads, CSRF writes and query parameters', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const action = new URL(`https://studio.example${url}`).searchParams.get('action');
    const payload = action === 'prospecting-missions' && (!options.method || options.method === 'GET')
      ? { data: [], csrfToken: 'csrf-fixture' }
      : action === 'prospecting-missions' && options.method === 'POST'
        ? { mission: { public_id: 'mission_new' } }
        : action === 'prospecting-missions' && options.method === 'PATCH'
          ? { mission: { public_id: 'mission_1', status: 'READY' } }
          : action === 'prospecting-mission-prospects'
            ? { duplicate: false, membership: {} }
            : action === 'prospecting-approvals'
              ? { approval: { public_id: 'approval_1' } }
              : { data: [] };
    return new Response(JSON.stringify(payload), { status: options.method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' } });
  };
  const { prospectingApi } = await import(`../src/lib/prospectingApi.js?client-test=${Date.now()}`);
  await prospectingApi.listMissions();
  await prospectingApi.createMission({ name: 'Mission' });
  await prospectingApi.updateMission('mission_1', { status: 'READY' });
  await prospectingApi.addMissionProspect('mission_1', 'prospect_1');
  await prospectingApi.createApproval('prospect_1', { action: 'APPROVE_PROSPECT' });
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'csrf-fixture');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.match(calls[2].url, /id=mission_1/);
  assert.match(calls[3].url, /mission_id=mission_1/);
  assert.match(calls[4].url, /prospect_id=prospect_1/);
  assert.ok(calls.every((call) => call.url.startsWith('/api/index.php?')));
});

test('prospecting client rejects malformed list responses', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
  const { prospectingApi } = await import(`../src/lib/prospectingApi.js?malformed-test=${Date.now()}`);
  await assert.rejects(prospectingApi.listProspects(), /invalid response/);
});
