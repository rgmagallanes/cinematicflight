import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CaretLeft, CaretRight, Paperclip } from '@phosphor-icons/react';

const previewTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
function decode(file, data) {
  if (!previewTypes.has(data.contentType) || data.contentType !== file.contentType || data.id !== file.id || !Number.isInteger(data.byteSize) || data.byteSize < 1 || data.byteSize > 8388608 || typeof data.contentBase64 !== 'string' || data.contentBase64.length > 11184812) throw new Error('This file cannot be previewed safely.');
  const bytes = Uint8Array.from(atob(data.contentBase64), ch => ch.charCodeAt(0));
  if (bytes.length !== data.byteSize || bytes.length !== file.byteSize) throw new Error('Attachment size changed. Refresh the review screen.');
  return bytes;
}

function AttachmentThumbnail({ file, load, enabled, onOpen, onAccessError }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true, url = null;
    (async () => {
      try {
        const data = await load(file.id);
        if (!live) return;
        const bytes = decode(file, data);
        url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
        setPreview(url);
      } catch (err) {
        if (live) { setError('Thumbnail unavailable'); if (err.status === 401 || err.status === 403) onAccessError(err); }
      }
    })();
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [file, load, onAccessError]);
  return <button type="button" className="ri-attachment-thumb" disabled={!enabled} onClick={onOpen} aria-label={`Open ${file.name} preview`}>
    {preview ? <img src={preview} alt="" onError={() => { URL.revokeObjectURL(preview); setPreview(null); setError('Thumbnail unavailable'); }} /> : <span aria-live="polite">{error || 'Loading image…'}</span>}
  </button>;
}

function Preview({ files, initialId, load, onClose, onAccessError }) {
  const [id, setId] = useState(initialId);
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef(null), overlay = useRef(null), close = useRef(null);
  const index = files.findIndex(file => file.id === id), file = files[index];
  const move = direction => setId(files[(index + direction + files.length) % files.length].id);
  useEffect(() => {
    const origin = document.activeElement;
    const background = [...document.body.children].filter(el => el !== overlay.current).map(el => [el, el.hasAttribute('inert')]);
    background.forEach(([el]) => el.setAttribute('inert', ''));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    return () => { background.forEach(([el, wasInert]) => { if (!wasInert) el.removeAttribute('inert'); }); document.body.style.overflow = overflow; if (origin?.isConnected) origin.focus(); };
  }, []);
  useEffect(() => {
    let live = true, url = null;
    setContent(null); setError('');
    (async () => {
      try {
        const data = await load(file.id);
        if (!live) return;
        const bytes = decode(file, data);
        if (data.contentType === 'text/plain') setContent({ id, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) });
        else { url = URL.createObjectURL(new Blob([bytes], { type: data.contentType })); setContent({ id, url }); }
      } catch (err) { if (live) { setError(err.message || 'Preview could not be loaded.'); if (err.status === 401 || err.status === 403) onAccessError(err); } }
    })();
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [id, attempt, load]);
  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (files.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    if (event.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  return createPortal(<div className="ri-file-backdrop" ref={overlay} onKeyDown={keys} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="ri-file-dialog" role="dialog" aria-modal="true" aria-labelledby="ri-file-title" aria-describedby="ri-file-safety" ref={dialog}>
      <header><div><h2 id="ri-file-title">{file.name}</h2><p>{file.contentType} · {size(file.byteSize)}</p></div><button className="ri-button ri-secondary" ref={close} onClick={onClose} aria-label="Close attachment preview"><X size={22} aria-hidden="true" /></button></header>
      <p id="ri-file-safety">Not reviewed · No AI analysis · Files are not malware-scanned</p>
      <div className="ri-file-stage" tabIndex={0} aria-label="Attachment content">
        {error ? <div role="alert"><p>{error}</p><button className="ri-button ri-secondary" onClick={() => setAttempt(n => n + 1)}>Retry preview</button></div> : content?.id !== id ? <p role="status">Loading private attachment…</p> : content.url ? <img src={content.url} alt={file.name} onError={() => setError('The image could not be decoded. It may be damaged or unsupported.')} /> : <pre>{content.text}</pre>}
      </div>
      <footer><button className="ri-button ri-secondary" aria-label="Previous attachment" disabled={files.length < 2} onClick={() => move(-1)}><CaretLeft size={20} aria-hidden="true" /></button><span aria-live="polite">{index + 1} of {files.length} previewable files</span><button className="ri-button ri-secondary" aria-label="Next attachment" disabled={files.length < 2} onClick={() => move(1)}><CaretRight size={20} aria-hidden="true" /></button></footer>
    </section>
  </div>, document.body);
}

export default function ReviewAttachments({ manifest, load, enabled = true, onAccessError = () => {} }) {
  const [selected, setSelected] = useState(null);
  const cache = useRef(new Map());
  const files = manifest?.items || [];
  const previewable = files.filter(file => file.status === 'ready' && previewTypes.has(file.contentType));
  const cachedLoad = useCallback(id => {
    if (!cache.current.has(id)) cache.current.set(id, Promise.resolve().then(() => load(id)).catch(error => { cache.current.delete(id); throw error; }));
    return cache.current.get(id);
  }, [load]);
  useEffect(() => { if (!enabled) setSelected(null); }, [enabled]);
  return <section className="ri-attachments" aria-labelledby="ri-attachments-title">
    <h3 id="ri-attachments-title"><Paperclip size={18} aria-hidden="true" />Attachments{manifest?.checked ? ` (${files.length})` : ''}</h3>
    {!manifest?.checked ? <p>Attachments have not been checked yet. Run the separate attachment sync; no AI call is needed.</p> : files.length === 0 ? <p>No attachments were reported for this email.</p> : <>
      <p className="ri-attachment-warning">Attachments received — not reviewed. Opening a preview does not approve or analyze the file.</p>
      <ul>{files.map(file => { const ready = file.status === 'ready' && previewTypes.has(file.contentType); const image = ready && imageTypes.has(file.contentType); return <li key={file.id} className={`ri-attachment-item${image ? ' ri-has-thumb' : ''}`}>
        {image && <AttachmentThumbnail file={file} load={cachedLoad} enabled={enabled} onOpen={() => setSelected(file.id)} onAccessError={onAccessError} />}
        <div className="ri-attachment-details"><strong>{file.name}</strong><span>{file.contentType} · {size(file.byteSize)}{file.inline ? ' · Inline image / signature' : ''}</span>{ready ? <button className="ri-button ri-secondary" disabled={!enabled} onClick={() => setSelected(file.id)}>Open full preview</button> : <p>{file.status === 'metadata_only' ? 'Preview not downloaded yet. Run the attachment sync and refresh.' : file.byteSize > 8388608 ? 'Over the 8 MB preview limit; not downloaded.' : 'Preview not supported for this file type; not downloaded.'}</p>}</div>
      </li>; })}</ul>
      <p>Private previews support JPEG, PNG, WebP, GIF and UTF-8 text, up to 8 MB per file. PDFs, Office documents, archives and executable content are listed only.</p>
    </>}
    {enabled && selected !== null && previewable.some(file => file.id === selected) && <Preview files={previewable} initialId={selected} load={cachedLoad} onClose={() => setSelected(null)} onAccessError={onAccessError} />}
  </section>;
}
