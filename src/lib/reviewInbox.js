export const REVIEW_STATUS = { pending: 'Needs review', approved: 'Approved · not sent', rejected: 'Rejected' };
export const TEST_ENQUIRY = 'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?';

function boundedText(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return value;
}

export function parseDraftImport(input) {
  if (typeof input !== 'string' || input.length > 50000) throw new Error('Paste one draft JSON output, up to 50 KB. Never paste API keys.');
  let parsed;
  try { parsed = JSON.parse(input); } catch { throw new Error('That is not valid JSON. Copy the complete Output → JSON from Review unsent draft.'); }
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) throw new Error('Import one designated test draft at a time.');
    [parsed] = parsed;
  }
  if (!parsed || parsed.subject !== 'CF-AI-TEST-001' || parsed.mailbox !== 'hello@cinematicflight.com'
    || parsed.enquiryText !== TEST_ENQUIRY || parsed.sourceUid !== 2
    || parsed.sentToClient !== false || parsed.approvalRecorded !== false || parsed.aiUsed !== true) {
    throw new Error('Use the unsent CF-AI-TEST-001 output from One Test Email to Draft. Real enquiries and pre-approved imports are not supported yet.');
  }
  return {
    id: `hello:INBOX:${parsed.sourceUid}:CF-AI-TEST-001`,
    subject: parsed.subject, mailbox: parsed.mailbox, sourceUid: parsed.sourceUid,
    enquiryText: parsed.enquiryText,
    originalText: boundedText(parsed.draftReply, 'Draft reply', 10000),
    model: boundedText(parsed.model, 'Model', 150),
  };
}

export function createReviewRecord(source, at = new Date().toISOString()) {
  return { ...source, text: source.originalText, status: 'pending', version: 1, revision: 1, approval: null,
    importedAt: at, updatedAt: at,
    history: [{ action: 'imported', version: 1, revision: 1, at, text: source.originalText, note: 'Manually imported n8n test output; not independently authenticated.' }],
  };
}

export function transitionReview(record, expectedVersion, command, at = new Date().toISOString()) {
  if (!record) throw new Error('Draft not found. Refresh the inbox.');
  if (record.version !== expectedVersion) throw new Error('This draft changed in another tab. Load the latest saved version before continuing. Your local edits are still visible.');
  const next = { ...record, history: [...record.history], version: record.version + 1, updatedAt: at };
  let note = '';
  if (command.action === 'edited') {
    next.text = boundedText(command.text, 'Reply', 10000);
    if (next.text === record.text) throw new Error('There are no changes to save.');
    next.revision += 1;
    next.status = 'pending';
    next.approval = null;
    note = record.status === 'approved' ? 'Previous approval no longer applies to the edited reply.' : 'Saved for a fresh review.';
  } else if (command.action === 'approved') {
    if (record.status !== 'pending') throw new Error('Return this draft to review before approving it.');
    if (command.confirmed !== true || command.text !== record.text) throw new Error('Save your edits and confirm you reviewed this exact text before approval.');
    next.status = 'approved';
    next.approval = { revision: record.revision, text: record.text, at, actor: 'Local owner' };
    note = 'Approval recorded for this exact revision. Nothing sent.';
  } else if (command.action === 'rejected') {
    if (record.status !== 'pending') throw new Error('Return this draft to review before rejecting it.');
    if (command.text !== record.text) throw new Error('Save or discard your edits before recording a decision.');
    note = boundedText(command.note, 'Rejection reason', 1000).trim();
    next.status = 'rejected';
    next.approval = null;
  } else if (command.action === 'reopened') {
    if (record.status === 'pending') throw new Error('This draft already needs review.');
    next.status = 'pending';
    next.approval = null;
    note = 'Returned to review; any previous approval no longer applies.';
  } else throw new Error('Unknown review action.');
  next.history.push({ action: command.action, version: next.version, revision: next.revision, at, text: next.text, note });
  return next;
}

// IndexedDB's read/write transaction serializes competing tab decisions.
// This is local-owner bookkeeping, not tamper-proof production authorization.
export function createReviewStore(factory = globalThis.indexedDB, name = 'cinematic-flight-review-v1') {
  let connection;
  const open = () => {
    if (!factory) return Promise.reject(new Error('Local database storage is unavailable. Use a regular browser window with storage enabled.'));
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
      request.onerror = () => { connection = null; reject(new Error('Cannot open the local inbox. Check browser storage permissions.')); };
      request.onblocked = () => { connection = null; reject(new Error('Close older review-inbox tabs and try again.')); };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
    });
    return connection;
  };
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      let result, failure;
      const abort = error => { failure = error; tx.abort(); };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || new Error('The local save failed. Nothing was committed; check available browser storage and retry.'));
      tx.onerror = () => { failure ||= new Error('The local save failed. Your draft has not been changed.'); };
      try { operation(tx.objectStore('drafts'), value => { result = value; }, abort); } catch (error) { abort(error); }
    });
  }
  return {
    async list() {
      const records = await transaction('readonly', (store, done) => { const req = store.getAll(); req.onsuccess = () => done(req.result); });
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async importDraft(input) {
      const source = parseDraftImport(input);
      return transaction('readwrite', (store, done, abort) => {
        const request = store.get(source.id);
        request.onsuccess = () => {
          try {
            const existing = request.result;
            if (existing) {
              if (existing.originalText !== source.originalText) throw new Error('This email already has a saved draft. Open it to edit; importing a new generation cannot overwrite your decisions.');
              done({ record: existing, duplicate: true }); return;
            }
            const record = createReviewRecord(source);
            store.add(record); done({ record, duplicate: false });
          } catch (error) { abort(error); }
        };
      });
    },
    async change(id, version, command) {
      return transaction('readwrite', (store, done, abort) => {
        const request = store.get(id);
        request.onsuccess = () => {
          try { const record = transitionReview(request.result, version, command); store.put(record); done(record); }
          catch (error) { abort(error); }
        };
      });
    },
    async close() { if (connection) (await connection).close(); connection = null; },
  };
}
