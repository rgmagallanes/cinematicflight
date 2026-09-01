import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, Check, DownloadSimple, EnvelopeOpen, FloppyDisk, LockSimple, UploadSimple, X } from '@phosphor-icons/react';
import { createReviewStore, REVIEW_STATUS } from './lib/reviewInbox.js';
import './review-inbox.css';

// Local extension of Studio's reading desk: the reply leads, the enquiry and
// revision history support it. Forest/paper/brass, existing Avenir typography.
// Approval is a revision-bound local record, never authority to send email.
const store = createReviewStore();
const workflowUrl = 'http://localhost:5678/workflow/CfHostingerDraftTest001';
const formatDate = at => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const actionNames = { imported: 'Imported from n8n', edited: 'Reply edited', approved: 'Approved, not sent', rejected: 'Rejected', reopened: 'Returned to review' };

function ReviewEditor({ record, refresh, announce, navigationBlocked }) {
  const [base, setBase] = useState(record);
  const [text, setText] = useState(record.text);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = text !== base.text;
  const stale = base.version !== record.version;
  const replyRef = useRef(null);

  useEffect(() => {
    navigationBlocked.current = dirty || busy;
    return () => { navigationBlocked.current = false; };
  }, [dirty, busy, navigationBlocked]);

  useEffect(() => {
    if (!dirty && !busy && base.version !== record.version) {
      setBase(record); setText(record.text); setConfirmed(false); setRejecting(false);
    }
  }, [record, dirty, busy, base.version]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function change(command) {
    setBusy(true); setError('');
    try {
      const saved = await store.change(base.id, base.version, command);
      setBase(saved); setText(saved.text); setConfirmed(false); setRejecting(false); setReason('');
      announce(command.action === 'edited' ? 'Edits saved. This revision needs review.' : saved.history.at(-1).note);
      await refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function exportHistory() {
    const blob = new Blob([JSON.stringify({ format: 'cinematic-flight-local-review-history-v1', exportedAt: new Date().toISOString(), record: base }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `CF-AI-TEST-001-review-r${base.revision}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Saved history exported. Keep the file private. Unsaved edits are not included.');
  }
  return <article className="ri-editor" aria-labelledby="reply-title">
    <header className="ri-editor-heading">
      <div><h2 id="reply-title">{base.subject}</h2><p>{base.mailbox} <span aria-hidden="true">·</span> Message {base.sourceUid}</p></div>
      <span className={`ri-status ri-status-${base.status}`}>{REVIEW_STATUS[base.status]}</span>
    </header>
    <div className="ri-reading-layout">
      <section className="ri-enquiry" aria-labelledby="enquiry-heading">
        <h3 id="enquiry-heading">The enquiry</h3><p className="ri-enquiry-text">{base.enquiryText}</p>
        <dl><dt>Source</dt><dd>Manual n8n import · fictional test</dd><dt>Imported</dt><dd>{formatDate(base.importedAt)}</dd><dt>Drafted with</dt><dd>{base.model}</dd></dl>
        <details><summary>Original AI draft</summary><p className="ri-preserve">{base.originalText}</p></details>
        <p className="ri-review-note">Check photo suitability and website compatibility separately. Neither has been assessed by this workflow.</p>
      </section>
      <section className="ri-reply" aria-labelledby="draft-heading">
        <div className="ri-section-heading"><h3 id="draft-heading">Your reply</h3><span>Revision {base.revision} {dirty ? '· Unsaved edits' : '· Saved locally'}</span></div>
        <label className="sr-only" htmlFor="review-reply">Edit draft reply</label>
        <textarea id="review-reply" ref={replyRef} value={text} maxLength={10000} disabled={busy} onChange={event => { setText(event.target.value); setConfirmed(false); setError(''); }} aria-describedby="reply-guidance" spellCheck />
        <p id="reply-guidance" className="ri-help">Check facts, tone, commitments and the next step. Saving any edit requires a fresh approval.</p>
        {stale && <div role="alert" className="ri-error">Another tab saved a newer version. Copy any local edits you want to keep, then <button type="button" onClick={() => { setBase(record); setText(record.text); setConfirmed(false); setError(''); }}>discard local edits and load the latest version</button>.</div>}
        {error && <p className="ri-error" role="alert">{error}</p>}
        <div className="ri-edit-actions"><button className="ri-button ri-secondary" disabled={!dirty || !text.trim() || busy || stale} onClick={() => change({ action: 'edited', text })}><FloppyDisk size={18} aria-hidden="true" />Save edits</button><span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>{dirty && <button className="ri-text-button" disabled={busy} onClick={() => { setText(base.text); setConfirmed(false); setError(''); }}>Discard unsaved edits</button>}</div>
        <div className="ri-decision">
          {base.status === 'pending' ? <>
            <label className="ri-confirm"><input type="checkbox" checked={confirmed} disabled={dirty || busy || stale} onChange={e => setConfirmed(e.target.checked)} /><span>I reviewed the exact saved text in revision {base.revision}.</span></label>
            {dirty && <p className="ri-help">Save or discard your edits before recording a decision.</p>}
            <div className="ri-decision-actions"><button className="ri-button ri-primary" disabled={!confirmed || dirty || busy || stale} onClick={() => change({ action: 'approved', text, confirmed })}><Check size={19} aria-hidden="true" />Approve revision {base.revision}</button><button className="ri-button ri-secondary" disabled={dirty || busy || stale} aria-expanded={rejecting} onClick={() => setRejecting(!rejecting)}><X size={18} aria-hidden="true" />Reject draft</button></div>
            {rejecting && <form className="ri-reject-form" onSubmit={e => { e.preventDefault(); change({ action: 'rejected', text, note: reason }); }}><label htmlFor="reject-reason">Reason for rejection</label><textarea id="reject-reason" value={reason} onChange={e => setReason(e.target.value)} required maxLength={1000} rows={2} /><button className="ri-button ri-secondary" disabled={!reason.trim() || dirty || busy || stale}>Record rejection</button></form>}
          </> : <div className="ri-recorded"><p>{base.status === 'approved' ? `Revision ${base.revision} was approved at ${formatDate(base.approval.at)}. Nothing was sent.` : `Rejected: ${base.history.at(-1).note}`}</p><button className="ri-button ri-secondary" disabled={dirty || busy || stale} onClick={() => change({ action: 'reopened' })}>Return to review</button></div>}
          <p className="ri-no-send"><LockSimple size={16} aria-hidden="true" />Approval records a decision only. Sending is not connected.</p>
        </div>
      </section>
    </div>
    <section className="ri-history" aria-labelledby="history-heading"><div className="ri-section-heading"><h3 id="history-heading">Revision & decision history</h3><button className="ri-text-button" onClick={exportHistory}><DownloadSimple size={18} aria-hidden="true" />Export saved history</button></div>
      <ol>{[...base.history].reverse().map(entry => <li key={entry.version}><details><summary><strong>{actionNames[entry.action]}</strong><span>Revision {entry.revision}</span><time dateTime={entry.at}>{formatDate(entry.at)}</time></summary><p>{entry.note}</p><p className="ri-preserve">{entry.text}</p></details></li>)}</ol>
    </section>
  </article>;
}

export default function ReviewInbox() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [payload, setPayload] = useState('');
  const [importError, setImportError] = useState('');
  const [savingImport, setSavingImport] = useState(false);
  const channel = useRef(null);
  const navigationBlocked = useRef(false);
  const contentRef = useRef(null);
  const [focusImported, setFocusImported] = useState(false);
  useEffect(() => {
    if (focusImported && !importing) { contentRef.current?.focus(); setFocusImported(false); }
  }, [focusImported, importing]);
  function selectDraft(id) {
    if (id !== selectedId && navigationBlocked.current) {
      setNotice('Save or discard your reply edits before switching drafts.');
      return;
    }
    setSelectedId(id);
  }
  async function load() {
    try { const rows = await store.list(); setRecords(rows); setSelectedId(id => id || rows[0]?.id || null); setError(''); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function refresh() { await load(); channel.current?.postMessage('changed'); }
  useEffect(() => {
    document.title = 'Review inbox · Cinematic Flight Studio';
    load();
    if (typeof BroadcastChannel !== 'undefined') { channel.current = new BroadcastChannel('cf-review-inbox'); channel.current.onmessage = load; }
    window.addEventListener('focus', load);
    return () => { channel.current?.close(); window.removeEventListener('focus', load); };
  }, []);
  const visible = useMemo(() => records.filter(r => (filter === 'all' || r.status === filter) && `${r.subject} ${r.enquiryText}`.toLowerCase().includes(query.toLowerCase())), [records, filter, query]);
  const selected = records.find(r => r.id === selectedId);
  async function importDraft(event) {
    event.preventDefault(); setImportError('');
    if (navigationBlocked.current) { setImportError('Save or discard your reply edits before importing.'); return; }
    setSavingImport(true);
    try { const result = await store.importDraft(payload); await refresh(); setSelectedId(result.record.id); setFilter('all'); setQuery(''); setPayload(''); setImporting(false); setFocusImported(true); setNotice(result.duplicate ? 'Already imported. Your saved edits and decisions are unchanged.' : 'Draft saved locally. It is ready for your review.'); }
    catch (err) { setImportError(err.message); } finally { setSavingImport(false); }
  }
  return <main className="review-inbox">
    <a className="ri-skip" href="#review-content">Skip to draft</a>
    <header className="ri-topbar"><a href="/dashboard" className="ri-brand"><img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight Studio" /></a><span><LockSimple size={17} aria-hidden="true" />Local review workspace</span><a href="/dashboard"><ArrowLeft size={16} aria-hidden="true" />Studio</a></header>
    <div className="ri-page">
      <header className="ri-page-heading"><div><h1>Review inbox</h1><p>AI writes the first draft. You decide what is ready.</p></div><button className="ri-button ri-primary" onClick={() => setImporting(!importing)} aria-expanded={importing} aria-controls="draft-import"><UploadSimple size={19} aria-hidden="true" />{importing ? 'Close import' : 'Import n8n draft'}</button></header>
      <div className="ri-local-note">Saved in this browser on this Mac. No cloud sync, automatic inbox checking or sending. Clearing browser data removes these records.</div>
      <p className="ri-notice" role="status" aria-live="polite">{notice}</p>
      {error && <div role="alert" className="ri-error">{error} <button className="ri-text-button" onClick={load}>Retry loading</button></div>}
      {importing && <section className="ri-import" id="draft-import" aria-labelledby="import-title"><h2 id="import-title">Bring in a draft</h2><p>Open <a href={workflowUrl} target="_blank" rel="noreferrer">One Test Email to Draft <ArrowSquareOut size={15} aria-hidden="true" /></a>, then copy <strong>Review unsent draft → Output → JSON</strong>. This local version accepts only the designated fictional test email.</p><form onSubmit={importDraft}><label htmlFor="draft-json">Paste the complete JSON output—not an API token</label><textarea id="draft-json" value={payload} maxLength={50000} onChange={e => { setPayload(e.target.value); setImportError(''); }} rows={5} spellCheck={false} aria-invalid={!!importError} aria-describedby={importError ? 'import-error' : undefined} /><div className="ri-edit-actions"><button className="ri-button ri-primary" disabled={savingImport || !payload.trim()}>{savingImport ? 'Importing…' : 'Save draft to inbox'}</button><span>Repeated imports never overwrite saved decisions.</span></div>{importError && <p id="import-error" className="ri-error" role="alert">{importError}</p>}</form></section>}
      <div className="ri-workspace"><aside className="ri-queue" aria-label="Draft queue"><div className="ri-queue-heading"><h2>Drafts</h2><span>{records.length}</span></div><label className="sr-only" htmlFor="review-search">Search drafts</label><input id="review-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search drafts" /><label className="sr-only" htmlFor="review-filter">Filter by review status</label><select id="review-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All drafts ({records.length})</option>{Object.entries(REVIEW_STATUS).map(([value,label]) => <option key={value} value={value}>{label} ({records.filter(r => r.status === value).length})</option>)}</select>
        {loading ? <p role="status">Opening local inbox…</p> : visible.length ? <ul>{visible.map(r => <li key={r.id}><button className={r.id === selectedId ? 'is-selected' : ''} aria-pressed={r.id === selectedId} onClick={() => selectDraft(r.id)}><strong>{r.subject}</strong><span className={`ri-status ri-status-${r.status}`}>{REVIEW_STATUS[r.status]}</span><span className="ri-excerpt">{r.enquiryText}</span><small>Revision {r.revision} · {formatDate(r.updatedAt)}</small></button></li>)}</ul> : <p className="ri-help">{records.length ? 'No drafts match this filter.' : 'Your first draft will appear here.'}</p>}
      </aside><div id="review-content" ref={contentRef} tabIndex={-1}>{selected ? <ReviewEditor key={selected.id} record={selected} refresh={refresh} announce={setNotice} navigationBlocked={navigationBlocked} /> : <section className="ri-empty"><EnvelopeOpen size={44} weight="light" aria-hidden="true" /><h2>A place for your final say</h2><p>Import the test reply from n8n. Read it beside the enquiry, make your edits, then record your decision.</p><button className="ri-button ri-primary" onClick={() => setImporting(true)}>Import your first draft</button><p className="ri-help">No generated examples or client records are preloaded.</p></section>}</div></div>
    </div>
  </main>;
}
