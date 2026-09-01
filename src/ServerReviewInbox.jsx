import { useEffect, useRef, useState } from 'react';
import { Check, FloppyDisk, LockSimple, ArrowClockwise, SignOut, X } from '@phosphor-icons/react';
import { serverReviewApi as api } from './lib/serverReviewApi.js';
import { REVIEW_STATUS } from './lib/reviewInbox.js';
import ReviewAttachments from './ReviewAttachments.jsx';
import './review-inbox.css';

// Studio reading-desk extension: forest/paper/brass, Avenir, dominant reply.
// Original enquiry and exact message link remain visible beside each decision.
// Separate local server mode: controlled n8n imports and retained local fixture.
// No browser-data migration or send. Decisions require server acknowledgement.
const date = value => new Date(value).toLocaleString();

function ServerEditor({ record, onChange, dirtyRef, workingCopy, preserveCopy, attachmentLoad, previewAllowed, onAccessError }) {
  const [base, setBase] = useState(workingCopy?.base || record);
  const [text, setText] = useState(workingCopy?.text ?? record.text);
  const [confirmed, setConfirmed] = useState(false);
  const [linked, setLinked] = useState(false);
  const [reason, setReason] = useState(workingCopy?.reason || '');
  const [rejecting, setRejecting] = useState(workingCopy?.rejecting || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = text !== base.text;
  const hasWork = dirty || reason.length > 0;
  const stale = record.version !== base.version;
  const blocked = dirty || busy || stale;
  const contactChanged = record.linkStatus !== 'contact_matches';
  useEffect(() => {
    dirtyRef.current = hasWork || busy;
    preserveCopy(hasWork ? { base, text, reason, rejecting } : null);
    const warn = e => { if (hasWork) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { dirtyRef.current = false; window.removeEventListener('beforeunload', warn); };
  }, [hasWork, busy, dirtyRef, base, text, reason, rejecting, preserveCopy]);
  useEffect(() => {
    if (!hasWork && !busy && stale) { setBase(record); setText(record.text); setConfirmed(false); setLinked(false); setRejecting(false); }
  }, [record, hasWork, busy, stale]);
  async function save(command) {
    setBusy(true); setError('');
    try {
      const saved = await onChange(base.id, base.version, command);
      setBase(saved); setText(saved.text); setConfirmed(false); setLinked(false); setReason(''); setRejecting(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <article className="ri-editor" aria-labelledby="server-draft-title">
    <header className="ri-editor-heading"><div><h2 id="server-draft-title">{base.source.subject}</h2><p>Enquiry {base.inquiryId}</p></div><span className={`ri-status ri-status-${base.status}`}>{REVIEW_STATUS[base.status]}</span></header>
    <div className="ri-reading-layout">
      <section className="ri-enquiry" aria-labelledby="server-enquiry-title"><h3 id="server-enquiry-title">Original enquiry & reply link</h3>
        <p className="ri-enquiry-text">{base.source.enquiryText}</p>
        <dl><dt>Reply recipient</dt><dd>{base.source.replyTo}</dd><dt>Mailbox</dt><dd>{base.source.mailbox}</dd><dt>Original message</dt><dd>{base.source.messageId}</dd><dt>Mailbox identity</dt><dd>{base.source.folder} · UID {base.source.uid} · UIDVALIDITY {base.source.uidValidity ?? 'not verified'}</dd><dt>Source</dt><dd>{base.source.importMethod === 'n8n-local' ? 'Imported from the manual n8n test. The enquiry text shown is the approved excerpt sent to the AI, not a full email archive. Message identity and reply headers are not independently verified by this server.' : 'Seeded fictional local fixture. Not a Hostinger message or an AI generation.'}</dd><dt>Enquiry match</dt><dd>{contactChanged ? 'Contact changed — approval blocked' : 'Contact matches the designated test sender'}</dd></dl>
        <details><summary>Original draft before edits</summary><p className="ri-preserve">{base.originalText}</p></details>
        <ReviewAttachments manifest={record.attachments} load={attachmentLoad} enabled={previewAllowed} onAccessError={onAccessError} />
        <p className="ri-review-note">No provider verification or sent-mail tracking. Photo suitability and website compatibility still require separate checks.</p>
      </section>
      <section className="ri-reply" aria-labelledby="server-reply-title"><div className="ri-section-heading"><h3 id="server-reply-title">Your reply</h3><span>Revision {base.revision} · {dirty ? 'Unsaved edits' : 'Saved on local server'}</span></div>
        <label className="sr-only" htmlFor="server-reply">Edit server draft reply</label>
        <textarea id="server-reply" value={text} maxLength={10000} disabled={busy} onChange={e => { setText(e.target.value); setConfirmed(false); setLinked(false); setError(''); }} aria-describedby="server-reply-help" />
        <p id="server-reply-help" className="ri-help">Save changes before deciding. Every edit requires a fresh approval.</p>
        {stale && <p className="ri-error" role="alert">A newer version is saved. Copy any edits or rejection notes you need to keep, then <button onClick={() => { setBase(record); setText(record.text); setReason(''); setRejecting(false); setConfirmed(false); setLinked(false); setError(''); }}>discard edits and load the latest version</button>.</p>}
        {contactChanged && <p className="ri-error" role="alert">The enquiry contact changed. The previous approval cannot be used.</p>}
        {error && <p className="ri-error" role="alert">{error}</p>}
        <div className="ri-edit-actions"><button className="ri-button ri-secondary" disabled={!dirty || !text.trim() || busy || stale || reason.length > 0} onClick={() => save({ action: 'edited', text })}><FloppyDisk size={18} aria-hidden="true" />Save edits</button>{hasWork && <button className="ri-text-button" disabled={busy} onClick={() => { setText(base.text); setReason(''); setRejecting(false); setConfirmed(false); setLinked(false); }}>Discard unsaved work</button>}</div>
        {reason.length > 0 && <p className="ri-help">Your rejection note is unsaved. Record the rejection or discard it before approving or saving reply edits.</p>}
        <div className="ri-decision">
          {base.status === 'pending' ? <>
            <label className="ri-confirm"><input type="checkbox" checked={confirmed} disabled={blocked} onChange={e => setConfirmed(e.target.checked)} /><span>I reviewed the exact saved text in revision {base.revision}.</span></label>
            <label className="ri-confirm ri-link-confirm"><input type="checkbox" checked={linked} disabled={blocked || contactChanged} onChange={e => setLinked(e.target.checked)} /><span>I checked the enquiry, original message and reply recipient shown here.</span></label>
            <div className="ri-decision-actions"><button className="ri-button ri-primary" disabled={blocked || !confirmed || !linked || contactChanged || reason.length > 0} onClick={() => save({ action: 'approved', text, confirmed, linkConfirmed: linked })}><Check size={18} aria-hidden="true" />Approve revision {base.revision}</button><button className="ri-button ri-secondary" disabled={blocked} aria-expanded={rejecting} onClick={() => setRejecting(!rejecting)}><X size={18} aria-hidden="true" />Reject draft</button></div>
            {rejecting && <form className="ri-reject-form" onSubmit={e => { e.preventDefault(); save({ action: 'rejected', text, note: reason }); }}><label htmlFor="server-reason">Reason for rejection</label><textarea id="server-reason" value={reason} required maxLength={1000} rows={2} onChange={e => setReason(e.target.value)} /><button className="ri-button ri-secondary" disabled={blocked || !reason.trim()}>Record rejection</button></form>}
          </> : <div className="ri-recorded"><p>{base.status === 'approved' ? `Revision ${base.revision} approved at ${date(base.approval.at)}. Nothing sent.` : `Rejected: ${base.history.at(-1).note}`}</p><button className="ri-button ri-secondary" disabled={blocked} onClick={() => save({ action: 'reopened' })}>Return to review</button></div>}
          <p className="ri-no-send"><LockSimple size={16} aria-hidden="true" />Server approval records your decision only. Sending is disabled.</p>
        </div>
      </section>
    </div>
    <section className="ri-history" aria-labelledby="server-history"><h3 id="server-history">Server revision & decision history</h3><ol>{[...base.history].reverse().map(entry => <li key={entry.version}><details><summary><strong>{entry.action}</strong><span>Revision {entry.revision} · Owner {entry.actorId}</span><time dateTime={entry.at}>{date(entry.at)}</time></summary><p>{entry.note}</p><p className="ri-preserve">{entry.text}</p></details></li>)}</ol></section>
  </article>;
}

export default function ServerReviewInbox({ client = api }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('reviewer@example.test');
  const [password, setPassword] = useState('');
  const [record, setRecord] = useState(null);
  const [queue, setQueue] = useState([]);
  const selectedId = useRef(null);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);
  const epoch = useRef(0);
  const channel = useRef(null);
  const mutating = useRef(false);
  const work = useRef({}); // Tab memory only; keyed by authenticated owner and draft.
  async function refresh(requestedId = null) {
    if (mutating.current) return;
    const run = ++epoch.current;
    try {
      const session = await client.session();
      if (run !== epoch.current) return;
      if (!session.authenticated) { setUser(null); setRecord(null); setLocked(false); setError(''); if (Object.keys(work.current).length) setNotice('Session ended. Sign in as the same test owner to recover unsaved work. Do not reload this tab.'); return; }
      const response = await client.list();
      const wanted = Number.isInteger(requestedId) ? requestedId : selectedId.current;
      const chosen = response.data.find(row => Number(row.id) === wanted) || response.data[0];
      const saved = chosen ? (await client.get(chosen.id)).record : null;
      if (run !== epoch.current) return;
      setQueue(response.data); selectedId.current = saved?.id ?? null;
      setUser(session.user); setRecord(previous => previous && saved && previous.id === saved.id && previous.version > saved.version ? previous : saved); setLocked(false); setError('');
    } catch (err) { if (run === epoch.current) failure(err); }
    finally { if (run === epoch.current) setChecking(false); }
  }
  function failure(err) {
    setError(err.message);
    if (err.status === 401) { setUser(null); setRecord(null); setLocked(false); setNotice('Sign in as the same test owner to recover unsaved work. Do not reload this tab.'); }
    else setLocked(true);
  }
  useEffect(() => {
    document.title = 'Server review · Cinematic Flight Studio';
    refresh();
    const focus = () => { refresh(); };
    window.addEventListener('focus', focus);
    if (typeof BroadcastChannel !== 'undefined') { channel.current = new BroadcastChannel('cf-server-review-local'); channel.current.onmessage = focus; }
    return () => { ++epoch.current; window.removeEventListener('focus', focus); channel.current?.close(); };
  }, []);
  async function signIn(e) {
    e.preventDefault(); setBusy(true); setError(''); mutating.current = true; ++epoch.current;
    try { await client.login(email.trim(), password); setPassword(''); mutating.current = false; await refresh(); }
    catch (err) { setError(err.message); } finally { mutating.current = false; setBusy(false); }
  }
  async function signOut() {
    if (dirtyRef.current) { setNotice('Save, submit or discard your unsaved work before signing out.'); return; }
    setBusy(true); mutating.current = true; ++epoch.current;
    try { await client.logout(); setUser(null); setRecord(null); setNotice('Signed out. Saved decisions remain in the local database.'); channel.current?.postMessage('changed'); }
    catch (err) { failure(err); } finally { mutating.current = false; setBusy(false); }
  }
  async function change(id, expectedVersion, command) {
    mutating.current = true; ++epoch.current;
    try {
      const saved = (await client.change(id, expectedVersion, command)).record;
      setRecord(saved); setNotice('Saved on the local server. Nothing sent.'); channel.current?.postMessage('changed');
      return saved;
    } catch (err) {
      mutating.current = false;
      if (err.status === 409) await refresh();
      else if (err.status === 401 || !err.status || err.status >= 500) failure(err);
      throw err;
    } finally { mutating.current = false; }
  }
  return <main className="review-inbox">
    <a className="ri-skip" href="#server-content">Skip to review</a>
    <header className="ri-topbar"><a className="ri-brand" href="http://127.0.0.1:5180/review-inbox"><img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight Studio — browser-only inbox" /></a><span>Local server test</span>{user && <button className="ri-button ri-secondary ri-signout" onClick={signOut} disabled={busy}><SignOut size={18} aria-hidden="true" />Sign out</button>}</header>
    <div className="ri-page"><header className="ri-page-heading"><div><h1>Server review inbox</h1><p>Signed-in decisions, saved beyond this browser.</p></div>{user && <button className="ri-button ri-secondary" disabled={busy} onClick={refresh}><ArrowClockwise size={18} aria-hidden="true" />Refresh from server</button>}</header>
      <p className="ri-local-note">Saved on this Mac: the original sample and designated manual n8n test imports. No automatic inbox monitoring, sent-mail tracking or sending. Your browser-only inbox is separate.</p>
      {user && !locked && queue.length > 1 && <label className="ri-help">Saved test draft <select aria-label="Saved test draft" value={record?.id ?? ''} disabled={busy} onChange={e => { if (dirtyRef.current) { setNotice('Save or discard your unsaved work before switching drafts.'); return; } refresh(Number(e.target.value)); }}>{queue.map(row => <option key={row.id} value={row.id}>{row.inquiryId || `Draft ${row.id}`} · {row.status || 'pending'}</option>)}</select></label>}
      <p role="status" className="ri-notice">{notice}</p>
      {error && <div className="ri-error" role="alert">{error} {locked && <>Saved content is hidden until the connection is verified. <button onClick={refresh}>Retry connection</button></>}</div>}
      {checking ? <p role="status">Checking local server session…</p> : !user ? <section className="ri-server-login" id="server-content" tabIndex={-1}><h2>Sign in to the local test</h2><p>Use the separate test account, not your Hostinger password.</p><form onSubmit={signIn}><label htmlFor="server-email">Test account email</label><input id="server-email" type="email" value={email} required autoComplete="username" onChange={e => setEmail(e.target.value)} /><label htmlFor="server-password">Test account password</label><input id="server-password" type="password" value={password} required autoComplete="current-password" onChange={e => setPassword(e.target.value)} /><button className="ri-button ri-primary" disabled={busy || locked}>{busy ? 'Signing in…' : 'Sign in to local server'}</button></form></section> : <div id="server-content" tabIndex={-1} style={locked ? { display: 'none' } : undefined} inert={locked || undefined}><p className="ri-help">Signed in as {user.email}. Changes are saved only after the server confirms them.</p><div className="ri-server-desk">{record ? <ServerEditor attachmentLoad={client.attachment} previewAllowed={!locked} onAccessError={failure} key={`${user.id}:${record.id}`} record={record} onChange={change} dirtyRef={dirtyRef} workingCopy={work.current[`${user.id}:${record.id}`]} preserveCopy={copy => { const key = `${user.id}:${record.id}`; if (copy) work.current[key] = copy; else delete work.current[key]; }} /> : <section className="ri-empty"><h2>No server drafts yet</h2><p>The local fixture has not been initialized. No browser-only drafts are imported automatically.</p><button className="ri-button ri-secondary" onClick={refresh}>Check again</button></section>}</div></div>}
    </div>
  </main>;
}
