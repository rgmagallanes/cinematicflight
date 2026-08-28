import { useEffect, useMemo, useState } from "react";
import { loadInquiries, loadPropertyFiles, saveInquiry, savePropertyFiles, seedInquiries } from "./lib/studioData.js";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChartLineUp,
  ChatCircle,
  Check,
  CheckCircle,
  Circle,
  Clock,
  DownloadSimple,
  FileText,
  FloppyDisk,
  FolderOpen,
  FunnelSimple,
  Gauge,
  LinkSimple,
  ListBullets,
  ListNumbers,
  LockSimple,
  MagnifyingGlass,
  Paragraph,
  Plus,
  Quotes,
  TextB,
  TextItalic,
  TextUnderline,
  Table,
  Trophy,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const initialInquiries = [
  { id: 1, property: "Riverstone Lodge", contact: "Amelia Hart", email: "amelia@example.com", stage: "Proposal", activity: "Aug 25", next: "Follow up on proposal", actionStatus: "Due today", due: "9:30 AM", detail: "Proposal sent Aug 25" },
  { id: 2, property: "Alta Vista Retreat", contact: "Marco Silva", email: "marco@example.com", stage: "Replied", activity: "Aug 27", next: "Send availability + rates", actionStatus: "Due today", due: "11:00 AM", detail: "Replied Aug 27" },
  { id: 3, property: "The Banyan Estate", contact: "Elena Cruz", email: "elena@example.com", stage: "New", activity: "Aug 28", next: "Qualify and next steps", actionStatus: "Due today", due: "1:30 PM", detail: "Received Aug 28" },
  { id: 4, property: "Maréa Cliff House", contact: "Sofia Laurent", email: "sofia@example.com", stage: "Contacted", activity: "Aug 26", next: "Check in and close gaps", actionStatus: "Overdue", due: "3:30 PM", detail: "No reply yet" },
  { id: 5, property: "Haven Point Villa", contact: "Noah Bennett", email: "noah@example.com", stage: "Qualified", activity: "Aug 24", next: "Prepare property reading", actionStatus: "Upcoming", due: "Aug 29", detail: "Qualified Aug 24" },
  { id: 6, property: "Pinecrest House", contact: "Lina Reyes", email: "lina@example.com", stage: "Replied", activity: "Aug 23", next: "Schedule discovery call", actionStatus: "Upcoming", due: "Aug 31", detail: "Replied Aug 23" },
];

const initialPropertyFiles = [
  {
    id: "banyan", name: "The Banyan Estate", stage: "New", enquiryId: "ENQ-1287", received: "Aug 28, 2026", owner: "Alex Morgan", nextAction: "Capture missing views", sourceCount: 12,
    sourceFiles: ["Banyan_Estate_001.jpg", "Banyan_Estate_002.jpg", "Banyan_Estate_003.jpg", "Banyan_Estate_004.jpg", "Banyan_Estate_005.jpg"],
    documents: [
      { id: "banyan-reading", title: "Property reading", status: "Draft", version: 1, updated: "Today, 10:42 AM", created: "Aug 28, 2026, 10:18 AM", sections: [
        { id: "journey", title: "What carries the journey", content: "The Banyan Estate delivers a sense of arrival, privacy and a sense of expansive indoor–outdoor living. The approach through the banyan canopy, the sequence into the central courtyard and the framed ocean beyond are the property’s strongest narrative beats." },
        { id: "missing", title: "Missing views", content: "Aerial context that shows the estate’s position within the bay. Wider ocean establishing from further offshore. Night exterior of arrival and main terrace." },
        { id: "next", title: "Recommended next step", content: "Capture the missing establishing and aerial context. Add a twilight arrival pass and a night terrace scene to complete the story." },
      ] },
      { id: "banyan-playbook", title: "Sales playbook", status: "Saved", version: 1, updated: "Aug 27, 2026", created: "Aug 27, 2026", sections: [{ id: "position", title: "Positioning", content: "Lead with the website design and build service. Present the cinematic property journey as its signature experience." }] },
      { id: "banyan-email", title: "Follow-up email", status: "Sent", version: 1, updated: "Aug 26, 2026", created: "Aug 26, 2026", sections: [{ id: "email", title: "A first reading of your property", content: "Thank you for sharing the property. I have reviewed the material and would like to show you what the photographs could become inside a guided website experience." }] },
    ],
  },
  {
    id: "riverstone", name: "Riverstone Lodge", stage: "Proposal", enquiryId: "ENQ-1261", received: "Aug 21, 2026", owner: "Alex Morgan", nextAction: "Follow up on proposal", sourceCount: 9,
    sourceFiles: ["Riverstone_exterior.jpg", "Riverstone_arrival.jpg", "Riverstone_river.jpg"],
    documents: [
      { id: "riverstone-reading", title: "Property reading", status: "Ready", version: 2, updated: "Aug 24, 2026", created: "Aug 22, 2026", sections: [{ id: "journey", title: "What carries the journey", content: "The river approach, timber threshold and long views through the lodge give the property a natural arrival sequence." }, { id: "next", title: "Recommended next step", content: "Use the exterior arrival and river views as the first anchors, then transition indoors." }] },
      { id: "riverstone-proposal", title: "Proposal", status: "Sent", version: 1, updated: "Aug 25, 2026", created: "Aug 25, 2026", sections: [{ id: "scope", title: "Project scope", content: "Complete property website with a cinematic journey built from approved photography." }] },
    ],
  },
  {
    id: "alta", name: "Alta Vista Retreat", stage: "Replied", enquiryId: "ENQ-1274", received: "Aug 24, 2026", owner: "Alex Morgan", nextAction: "Schedule discovery call", sourceCount: 7,
    sourceFiles: ["AltaVista_overview.jpg", "AltaVista_terrace.jpg"],
    documents: [
      { id: "alta-reading", title: "Property reading", status: "Draft", version: 1, updated: "Aug 27, 2026", created: "Aug 27, 2026", sections: [{ id: "journey", title: "What carries the journey", content: "The elevated terrace and changing horizon can carry the opening, followed by the quieter interior thresholds." }] },
      { id: "alta-email", title: "Follow-up email", status: "Draft", version: 1, updated: "Aug 27, 2026", created: "Aug 27, 2026", sections: [{ id: "email", title: "Next steps", content: "I have completed the first pass through your existing photographs and would like to discuss the strongest sequence." }] },
    ],
  },
];

const navItems = [
  { id: "home", label: "Daily Flight Deck", icon: Gauge },
  { id: "enquiries", label: "Enquiries", icon: ChatCircle },
  { id: "pipeline", label: "Pipeline", icon: FunnelSimple },
  { id: "calendar", label: "Calendar", icon: CalendarBlank },
  { id: "documents", label: "Property Files", icon: FolderOpen },
];

const metrics = [
  { label: "New enquiries", value: "12", note: "vs 7-day avg 8" },
  { label: "Reached", value: "9", note: "75% of new" },
  { label: "Replies", value: "5", note: "56% of reached" },
  { label: "Qualified", value: "3", note: "vs 7-day avg 2" },
  { label: "Avg first response", value: "4h", note: "vs 7-day avg 6h" },
  { label: "Conversion (30 days)", value: "17%", note: "vs prior 30 days 12%", trend: true },
];

const stageOrder = ["New", "Contacted", "Replied", "Qualified", "Proposal", "Won"];
const actionStatusOptions = ["Due today", "Upcoming", "Overdue", "Completed"];
const pipelineSummary = [
  { stage: "New", value: 12, note: "+4 today" },
  { stage: "Contacted", value: 9, note: "75% reached" },
  { stage: "Replied", value: 5, note: "56% of reached" },
  { stage: "Qualified", value: 3, note: "60% of replied" },
  { stage: "Proposal", value: 2, note: "67% of qualified" },
  { stage: "Won", value: 1, note: "This period" },
];

function Sidebar({ activeView, setActiveView, cloudUser, onSignOut }) {
  return (
    <aside className="dashboard-sidebar">
      <button className="dashboard-brand" type="button" onClick={() => setActiveView("home")} aria-label="Cinematic Flight dashboard home">
        <img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight" />
      </button>
      <nav className="dashboard-nav" aria-label="Sales workspace">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            className={activeView === id ? "is-active" : ""}
            key={id}
            type="button"
            aria-label={label}
            onClick={() => setActiveView(id)}
          >
            <Icon size={22} weight={activeView === id ? "fill" : "regular"} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="private-note">
        <div><LockSimple size={17} weight="bold" aria-hidden="true" /> {cloudUser ? "Cloud protected" : "Local workspace"}</div>
        <p>{cloudUser ? cloudUser.email : "Demo data is stored only in this browser."}</p>
        {cloudUser && <button type="button" onClick={onSignOut}>Sign out</button>}
      </div>
    </aside>
  );
}

function PageHeader({ eyebrow, title, copy, action }) {
  return (
    <header className="dashboard-page-header">
      <div>
        {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action}
    </header>
  );
}

function MetricStrip() {
  return (
    <section className="metric-strip" aria-label="Sales reach summary">
      {metrics.map((metric) => (
        <article key={metric.label}>
          <p>{metric.label}</p>
          <strong>{metric.value}{metric.trend && <ChartLineUp size={32} weight="light" aria-label="Conversion trending upward" />}</strong>
          <span>{metric.note}</span>
        </article>
      ))}
    </section>
  );
}

function Status({ stage }) {
  return <span className={`status status-${stage.toLowerCase()}`}><i aria-hidden="true" />{stage}</span>;
}

function ActionStatus({ value = "Upcoming" }) {
  const slug = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`action-status action-status-${slug}`}><i aria-hidden="true" />{value}</span>;
}

function WinCelebration({ property, onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 3600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="win-celebration" role="status" aria-live="polite">
      <div className="win-trophy-stage">
        <div className="win-confetti" aria-hidden="true">
          {Array.from({ length: 34 }, (_, index) => <i key={index} style={{ "--angle": `${index * (360 / 34)}deg`, "--distance": `${92 + (index % 5) * 24}px`, "--delay": `${(index % 6) * 28}ms`, "--turn": `${240 + index * 23}deg` }} />)}
        </div>
        <div className="win-trophy"><Trophy size={68} weight="fill" aria-hidden="true" /></div>
        <div className="win-message">
          <span><strong>Enquiry won</strong><small>{property} has moved into the won stage.</small></span>
        </div>
      </div>
    </div>
  );
}

function HomeView({ inquiries, setActiveView, openInquiry, openAdd }) {
  const today = inquiries.slice(0, 4);
  return (
    <>
      <PageHeader
        title={<>Owner’s Daily<br />Flight Deck</>}
        copy="Your private sales cockpit. Focus on what needs attention today."
        action={<div className="today-stamp"><span>Friday, August 28, 2026</span><b>Today</b></div>}
      />
      <MetricStrip />

      <div className="dashboard-split">
        <section className="flight-plan">
          <div className="section-heading">
            <h2>Today’s flight plan</h2>
            <p>Focus on the next best action.</p>
          </div>
          <div className="task-list">
            {today.map((inquiry) => (
              <button type="button" className="task-row" key={inquiry.id} onClick={() => openInquiry(inquiry)}>
                <time>{inquiry.due}<small>Due</small></time>
                <span><strong>{inquiry.next}</strong><b>{inquiry.property}</b><ActionStatus value={inquiry.actionStatus} /></span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="section-actions">
            <button className="primary-action" type="button" onClick={() => openInquiry(today[0])}>Review next enquiry</button>
            <button className="text-action" type="button" onClick={openAdd}>Add enquiry <ArrowRight size={16} /></button>
            <button className="text-action" type="button" onClick={() => setActiveView("pipeline")}>View pipeline <ArrowRight size={16} /></button>
          </div>
        </section>

        <section className="recent-enquiries">
          <div className="section-heading">
            <h2>Recent enquiries</h2>
            <p>What’s landed and where it stands.</p>
          </div>
          <div className="enquiry-table" role="table" aria-label="Recent enquiries">
            <div className="table-head" role="row"><span>Property</span><span>Stage</span><span>Last activity</span></div>
            {inquiries.map((inquiry) => (
              <button type="button" role="row" key={inquiry.id} onClick={() => openInquiry(inquiry)}>
                <span>{inquiry.property}</span><Status stage={inquiry.stage} /><span>{inquiry.activity}{inquiry.stage === "New" && <b>New</b>}</span>
              </button>
            ))}
          </div>
          <button className="view-all" type="button" onClick={() => setActiveView("enquiries")}>View all enquiries <ArrowRight size={16} /></button>
        </section>
      </div>

      <section className="pipeline-glance">
        <div className="section-heading"><h2>Pipeline at a glance</h2><p>Active enquiries by stage.</p></div>
        <div className="pipeline-flow">
          {pipelineSummary.map(({ stage, value, note }, index) => {
            return (
              <div className="pipeline-step" key={stage}>
                <span>{stage}</span><strong>{value}</strong><small>{note}</small>
                {index < stageOrder.length - 1 && <ArrowRight size={17} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function EnquiriesView({ inquiries, openInquiry, openAdd }) {
  const [query, setQuery] = useState("");
  const filtered = inquiries.filter((item) => `${item.property} ${item.contact} ${item.stage}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHeader title="Enquiries" copy="Every property conversation, with the next action kept visible." action={<button className="primary-action" type="button" onClick={openAdd}><Plus size={17} /> Add enquiry</button>} />
      <label className="dashboard-search"><MagnifyingGlass size={19} /><span className="sr-only">Search enquiries</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, contact or stage" /></label>
      <section className="full-enquiry-list">
        <div className="full-list-head"><span>Property</span><span>Contact</span><span>Stage</span><span>Next action &amp; status</span><span>Last activity</span></div>
        {filtered.map((inquiry) => (
          <button type="button" key={inquiry.id} onClick={() => openInquiry(inquiry)}>
            <strong>{inquiry.property}</strong><span>{inquiry.contact}</span><Status stage={inquiry.stage} /><span className="next-action-cell"><b>{inquiry.next}</b><ActionStatus value={inquiry.actionStatus} /></span><time>{inquiry.activity}</time>
          </button>
        ))}
      </section>
    </>
  );
}

function PipelineView({ inquiries, openInquiry }) {
  return (
    <>
      <PageHeader title="Pipeline" copy="See where each conversation stands and what needs to move next." />
      <section className="pipeline-board" aria-label="Sales pipeline">
        {stageOrder.map((stage) => (
          <div className="pipeline-column" key={stage}>
            <header><span>{stage}</span><b>{inquiries.filter((item) => item.stage === stage).length}</b></header>
            {inquiries.filter((item) => item.stage === stage).map((inquiry) => (
              <button type="button" key={inquiry.id} onClick={() => openInquiry(inquiry)}>
                <strong>{inquiry.property}</strong><span>{inquiry.contact}</span><small>{inquiry.next}</small><ActionStatus value={inquiry.actionStatus} />
              </button>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

function CalendarView({ inquiries, openInquiry }) {
  return (
    <>
      <PageHeader title="Follow-ups" copy="A calm view of today, upcoming work and overdue conversations." />
      <section className="calendar-list">
        <header><span>Friday</span><strong>28</strong><p>August 2026</p></header>
        <div>
          {inquiries.slice(0, 4).map((inquiry) => (
            <button type="button" key={inquiry.id} onClick={() => openInquiry(inquiry)}><time>{inquiry.due}</time><span><strong>{inquiry.next}</strong><small>{inquiry.property}</small><ActionStatus value={inquiry.actionStatus} /></span><Status stage={inquiry.stage} /></button>
          ))}
        </div>
      </section>
    </>
  );
}

function PropertyFilesView({ inquiries, openInquiry, setActiveView, cloudUser }) {
  const [properties, setProperties] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cinematic-flight-property-files-v1")) || initialPropertyFiles; } catch { return initialPropertyFiles; }
  });
  const [activePropertyId, setActivePropertyId] = useState("banyan");
  const [activeDocumentId, setActiveDocumentId] = useState("banyan-reading");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [compactFilesOpen, setCompactFilesOpen] = useState(true);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importState, setImportState] = useState({ status: "idle", message: "" });
  const [cloudReady, setCloudReady] = useState(false);

  const activeProperty = properties.find((property) => property.id === activePropertyId) || properties[0];
  const activeDocument = activeProperty?.documents.find((document) => document.id === activeDocumentId) || activeProperty?.documents[0];
  const isImportedDocument = activeDocument?.status === "Imported";
  const currentStep = activeDocument?.status === "Sent" ? 3 : activeDocument?.status === "Ready" ? 2 : 1;

  useEffect(() => { localStorage.setItem("cinematic-flight-property-files-v1", JSON.stringify(properties)); }, [properties]);
  useEffect(() => {
    if (!cloudUser) return undefined;
    let active = true;
    loadPropertyFiles(cloudUser.id).then(async (remote) => {
      const next = remote.length ? remote : initialPropertyFiles;
      if (!remote.length) await savePropertyFiles(cloudUser.id, initialPropertyFiles);
      if (active) { setProperties(next); setCloudReady(true); }
    }).catch((error) => { if (active) setToast(`Cloud files unavailable: ${error.message}`); });
    return () => { active = false; };
  }, [cloudUser]);
  useEffect(() => {
    if (!cloudUser || !cloudReady) return undefined;
    const timer = window.setTimeout(() => savePropertyFiles(cloudUser.id, properties).catch((error) => setToast(`Cloud save failed: ${error.message}`)), 700);
    return () => window.clearTimeout(timer);
  }, [cloudReady, cloudUser, properties]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll(".property-document textarea").forEach((field) => {
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDocument]);

  const selectProperty = (property) => {
    setActivePropertyId(property.id);
    setActiveDocumentId(property.documents[0]?.id);
    setShowLibrary(false);
    setShowImporter(false);
    setCompactFilesOpen(true);
  };

  const updateDocument = (patch) => setProperties((current) => current.map((property) => property.id !== activeProperty.id ? property : {
    ...property,
    documents: property.documents.map((document) => document.id === activeDocument.id ? { ...document, ...patch, updated: "Today, 10:42 AM" } : document),
  }));

  const updateSection = (sectionId, patch) => updateDocument({ sections: activeDocument.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) });

  const createDocument = () => {
    const id = `${activeProperty.id}-${Date.now()}`;
    const document = { id, title: "Untitled document", status: "Draft", version: 1, updated: "Today, 10:42 AM", created: "Aug 28, 2026", sections: [{ id: `${id}-section`, title: "New section", content: "Start writing…" }] };
    setProperties((current) => current.map((property) => property.id === activeProperty.id ? { ...property, documents: [...property.documents, document] } : property));
    setActiveDocumentId(id);
    setShowLibrary(false);
    setShowImporter(false);
    setCompactFilesOpen(false);
    setToast("New document created");
  };

  const addImportedDocument = ({ title, sections, source }) => {
    const id = `${activeProperty.id}-import-${Date.now()}`;
    const importedDocument = { id, title, status: "Imported", version: 1, updated: "Just now", created: "Aug 28, 2026", source, sections };
    setProperties((current) => current.map((property) => property.id === activeProperty.id ? { ...property, documents: [...property.documents, importedDocument] } : property));
    setActiveDocumentId(id);
    setShowImporter(false);
    setShowLibrary(false);
    setCompactFilesOpen(false);
    setImportState({ status: "idle", message: "" });
    setSheetUrl("");
    setToast(`${title} imported locally`);
  };

  const importLocalFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setImportState({ status: "error", message: "Choose a file smaller than 10 MB." }); return; }
    setImportState({ status: "loading", message: `Reading ${file.name}…` });
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const title = file.name.replace(/\.[^.]+$/, "");
      let sections;
      if (extension === "docx") {
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        sections = [{ id: `${Date.now()}-content`, title: "Imported document", content: result.value.trim() || "This document did not contain readable text." }];
      } else if (["xlsx", "xls", "csv"].includes(extension)) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        sections = workbook.SheetNames.map((name, index) => ({ id: `${Date.now()}-${index}`, title: name, content: XLSX.utils.sheet_to_csv(workbook.Sheets[name]).trim() || "This sheet is empty." }));
      } else if (["txt", "md"].includes(extension)) {
        sections = [{ id: `${Date.now()}-content`, title: "Imported document", content: (await file.text()).trim() || "This document is empty." }];
      } else {
        throw new Error("Use a DOCX, TXT, MD, CSV, XLS, or XLSX file.");
      }
      const characterCount = sections.reduce((total, section) => total + section.content.length, 0);
      if (characterCount > 500000) throw new Error("This file contains too much text for local editing. Import a smaller selection or split it into separate files.");
      addImportedDocument({ title, sections, source: file.name });
    } catch (error) {
      setImportState({ status: "error", message: error?.message || "The file could not be read. Try exporting it again." });
    }
  };

  const googleSheetCsvUrl = (value) => {
    const trimmed = value.trim();
    if (/\/pubhtml(?:\?|$)/.test(trimmed)) return trimmed.replace(/\/pubhtml(?:\?.*)?$/, "/pub?output=csv");
    if (/\/pub(?:\?|$)/.test(trimmed)) return trimmed.includes("output=csv") ? trimmed : `${trimmed}${trimmed.includes("?") ? "&" : "?"}output=csv`;
    const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
    if (!match) throw new Error("Paste a complete Google Sheets link.");
    const gid = trimmed.match(/[?#&]gid=(\d+)/)?.[1] || "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
  };

  const importGoogleSheet = async (event) => {
    event.preventDefault();
    setImportState({ status: "loading", message: "Reading the published sheet…" });
    try {
      const response = await fetch(googleSheetCsvUrl(sheetUrl), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Google could not share this sheet. Set access to Anyone with the link, or publish it to the web.");
      const csv = await response.text();
      if (!csv.trim()) throw new Error("The sheet is empty or is not published as readable data.");
      if (csv.length > 500000) throw new Error("This sheet is too large for local editing. Import a smaller sheet or export a selected range as CSV.");
      addImportedDocument({ title: "Imported Google Sheet", source: sheetUrl.trim(), sections: [{ id: `${Date.now()}-sheet`, title: "Sheet 1", content: csv.trim() }] });
    } catch (error) {
      setImportState({ status: "error", message: error?.name === "TimeoutError" ? "Google Sheets did not respond. Check the link and try again." : error?.message || "The Google Sheet could not be imported." });
    }
  };

  const saveVersion = () => { updateDocument({ version: activeDocument.version + 1 }); setToast(`Version ${activeDocument.version + 1} saved locally`); };
  const markReady = () => { updateDocument({ status: "Ready" }); setToast("Property reading marked ready"); };

  const formatSelection = (before, after = before) => {
    const field = document.activeElement;
    if (!(field instanceof HTMLTextAreaElement) || !field.closest(".property-document")) { setToast("Select text in the document first"); return; }
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selection = field.value.slice(start, end) || "text";
    const next = `${field.value.slice(0, start)}${before}${selection}${after}${field.value.slice(end)}`;
    updateSection(field.dataset.sectionId, { content: next });
    window.requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + before.length, start + before.length + selection.length); });
  };

  const relatedInquiry = inquiries.find((inquiry) => inquiry.property === activeProperty.name);
  const filteredProperties = properties.filter((property) => `${property.name} ${property.documents.map((document) => document.title).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const steps = ["Material received", "Reading in progress", "Proposal", "Sent"];

  return (
    <section className={`property-files-screen ${isImportedDocument ? "is-imported-document" : ""}`}>
      <aside className={`property-file-navigator ${showImporter ? "is-importing" : ""} ${isImportedDocument && !compactFilesOpen && !showImporter && !showLibrary ? "is-reading-focused" : ""}`}>
        <header>Property Files</header>
        <label className="property-file-search"><MagnifyingGlass size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" aria-label="Search property files" /></label>
        <div className="property-folder-list">
          {filteredProperties.map((property) => {
            const expanded = property.id === activeProperty.id && !showLibrary;
            return <div className={`property-folder ${expanded ? "is-expanded" : ""}`} key={property.id}>
              <button type="button" onClick={() => selectProperty(property)} aria-expanded={expanded}><span><strong>{property.name}</strong><small>{property.documents.length} documents</small></span>{expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}</button>
              {expanded && <div className="property-doc-list">{property.documents.map((document) => <button className={document.id === activeDocument.id ? "is-active" : ""} type="button" key={document.id} onClick={() => { setActiveDocumentId(document.id); setCompactFilesOpen(false); }}><FileText size={17} /><span><strong>{document.title}</strong><small>{document.status} · {document.updated}</small></span></button>)}</div>}
            </div>;
          })}
        </div>
        <div className="property-file-actions">
          <button className="new-property-document" type="button" onClick={createDocument}><Plus size={17} /> New document</button>
          <button type="button" onClick={() => { setShowImporter(true); setShowLibrary(false); setImportState({ status: "idle", message: "" }); }}><UploadSimple size={17} /> Import file</button>
        </div>
      </aside>

      <div className="property-editor-column">
        {isImportedDocument && !showImporter && !showLibrary && <div className="mobile-reading-bar"><button type="button" onClick={() => setCompactFilesOpen((open) => !open)}><FolderOpen size={18} /> {compactFilesOpen ? "Close files" : "Property files"}</button><span>{activeProperty.name}</span></div>}
        <header className="property-progress-header">
          <div className="property-title-row"><h1>{activeProperty.name}</h1><span>{activeProperty.stage}</span></div>
          <ol className="document-progress" aria-label="Property document progress">{steps.map((step, index) => <li className={index === currentStep ? "is-current" : index < currentStep ? "is-complete" : ""} key={step}>{index < currentStep ? <CheckCircle size={21} weight="fill" /> : <Circle size={21} weight={index === currentStep ? "duotone" : "regular"} />}<span>{step}</span></li>)}</ol>
        </header>

        {showImporter ? <section className="property-import-workspace">
          <button className="back-to-editor" type="button" onClick={() => setShowImporter(false)}><ArrowLeft size={17} /> Back to reading</button>
          <header><h2>Import into {activeProperty.name}</h2><p>Bring an existing document or worksheet into this property’s working files.</p></header>
          <div className="property-import-methods">
            <section>
              <FileText size={24} weight="light" />
              <div><h3>From your computer</h3><p>Word, text, Markdown, CSV and Excel files are converted into an editable local document.</p><small>DOCX · TXT · MD · CSV · XLS · XLSX · 10 MB maximum</small></div>
              <label className="import-file-control"><UploadSimple size={17} /> Choose a file<input type="file" accept=".docx,.txt,.md,.csv,.xls,.xlsx" onChange={importLocalFile} /></label>
            </section>
            <form onSubmit={importGoogleSheet}>
              <Table size={24} weight="light" />
              <div><h3>From Google Sheets</h3><p>Paste a public or published Google Sheets link. The selected sheet becomes editable text inside Property Files.</p><small>Private sheets require a future Google account connection.</small></div>
              <label><span>Google Sheets link</span><input type="url" required value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /></label>
              <button type="submit" disabled={importState.status === "loading"}><Table size={17} /> {importState.status === "loading" ? "Importing…" : "Import Google Sheet"}</button>
            </form>
          </div>
          {importState.message && <p className={`property-import-status is-${importState.status}`} role={importState.status === "error" ? "alert" : "status"}>{importState.status === "error" && <WarningCircle size={17} />}{importState.message}</p>}
          <footer><LockSimple size={15} /> Local files are read in this browser. Nothing is uploaded by this prototype.</footer>
        </section> : showLibrary ? <section className="property-library-overview">
          <button className="back-to-editor" type="button" onClick={() => setShowLibrary(false)}><ArrowLeft size={17} /> Back to reading</button><h2>All property files</h2>
          <div className="library-file-table">{properties.flatMap((property) => property.documents.map((document) => ({ ...document, property }))).map((document) => <button type="button" key={document.id} onClick={() => { selectProperty(document.property); setActiveDocumentId(document.id); }}><FileText size={19} /><span><strong>{document.title}</strong><small>{document.property.name}</small></span><span>{document.status}</span><time>{document.updated}</time></button>)}</div>
        </section> : <>
          <div className="property-format-bar" aria-label="Document formatting">
            <span><Paragraph size={17} /> Paragraph <CaretDown size={13} /></span>
            <button type="button" aria-label="Bold selected text" onClick={() => formatSelection("**")}><TextB size={17} weight="bold" /></button>
            <button type="button" aria-label="Italicize selected text" onClick={() => formatSelection("_")}><TextItalic size={17} /></button>
            <button type="button" aria-label="Underline selected text" onClick={() => formatSelection("__")}><TextUnderline size={17} /></button>
            <button type="button" aria-label="Bulleted list" onClick={() => formatSelection("• ", "")}><ListBullets size={18} /></button>
            <button type="button" aria-label="Numbered list" onClick={() => formatSelection("1. ", "")}><ListNumbers size={18} /></button>
            <button type="button" aria-label="Quote" onClick={() => formatSelection("“", "”")}><Quotes size={18} /></button>
            <button type="button" aria-label="Add link" onClick={() => formatSelection("[", "](https://)")}><LinkSimple size={18} /></button>
            <small>Saved {activeDocument.updated}</small><b>Version {activeDocument.version}</b>
          </div>
          <article className={`property-document ${isImportedDocument ? "is-imported" : ""}`}>
            <div className="property-document-title"><input value={activeDocument.title} onChange={(event) => updateDocument({ title: event.target.value })} aria-label="Property document title" /><p>Version {activeDocument.version}<i aria-hidden="true" />{activeDocument.status}</p></div>
            <div className="property-document-sections">{activeDocument.sections.map((section) => <section key={section.id}><input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} aria-label="Section title" /><textarea data-section-id={section.id} value={section.content} onChange={(event) => { updateSection(section.id, { content: event.target.value }); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }} aria-label={`${section.title} content`} /></section>)}</div>
          </article>
          <footer className="property-editor-actions">
            <button className="mark-ready-action" type="button" onClick={markReady} disabled={activeDocument.status === "Ready"}>{activeDocument.status === "Ready" ? "Reading ready" : "Mark reading ready"}</button>
            <button type="button" onClick={saveVersion}><FloppyDisk size={17} /> Save version</button>
            <button type="button" onClick={() => window.print()}><DownloadSimple size={17} /> Export PDF</button>
            <button type="button" onClick={() => setShowLibrary(true)}><ArrowLeft size={17} /> Back to all files</button>
          </footer>
        </>}
      </div>

      <aside className="property-context-rail">
        <section><h2>Linked enquiry</h2><h3>{activeProperty.name}<Status stage={activeProperty.stage} /></h3><p>Enquiry #{activeProperty.enquiryId}</p><p>Received {activeProperty.received}</p><p>Owner: {activeProperty.owner}</p>{relatedInquiry && <button type="button" onClick={() => openInquiry(relatedInquiry)}>View enquiry <ArrowRight size={16} /></button>}</section>
        <section><h2>Source material</h2><h3>{activeProperty.sourceCount} photographs</h3><p>Added Aug 28, 2026</p><ul>{activeProperty.sourceFiles.map((file) => <li key={file}><FileText size={15} />{file}</li>)}</ul><p>+ {Math.max(0, activeProperty.sourceCount - activeProperty.sourceFiles.length)} more files</p></section>
        <section><h2>Document status</h2><h3>{activeDocument.status}<i aria-hidden="true" /> Version {activeDocument.version}</h3>{activeDocument.source && <p className="document-import-source">Imported from {activeDocument.source}</p>}<dl><div><dt>Created</dt><dd>{activeDocument.created}</dd></div><div><dt>Last saved</dt><dd>{activeDocument.updated}</dd></div></dl></section>
        <section><h2>Next sales action</h2><h3>{activeProperty.nextAction}</h3><strong>Priority: High</strong><p>Planned for Sep 2, 2026</p><button type="button" onClick={() => setActiveView("pipeline")}>View in pipeline <ArrowRight size={16} /></button></section>
      </aside>
      {toast && <div className="property-toast" role="status"><Check size={16} />{toast}</div>}
    </section>
  );
}

function InquiryDialog({ inquiry, onClose, onUpdate }) {
  const [form, setForm] = useState({ stage: inquiry.stage, next: inquiry.next, due: inquiry.due, actionStatus: inquiry.actionStatus || "Upcoming", note: inquiry.note || `Review ${inquiry.property} and prepare the next response.` });
  if (!inquiry) return null;
  const save = (event) => {
    event.preventDefault();
    onUpdate({ ...inquiry, ...form, activity: "Aug 28", detail: `${form.actionStatus} · ${form.due}` });
    onClose();
  };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="inquiry-dialog" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="inquiry-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close enquiry"><X size={20} /></button>
        <p className="dashboard-eyebrow">Next enquiry</p>
        <h2 id="inquiry-dialog-title">{inquiry.property}</h2>
        <div className="inquiry-dialog-status"><Status stage={form.stage} /><ActionStatus value={form.actionStatus} /></div>
        <dl><div><dt>Contact</dt><dd>{inquiry.contact}</dd></div><div><dt>Email</dt><dd>{inquiry.email}</dd></div><div><dt>Last activity</dt><dd>{inquiry.activity}</dd></div></dl>
        <div className="inquiry-workflow-fields">
          <label>Sales stage<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{stageOrder.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label>Action status<select value={form.actionStatus} onChange={(event) => setForm({ ...form, actionStatus: event.target.value })}>{actionStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="is-wide">Next action<input required value={form.next} onChange={(event) => setForm({ ...form, next: event.target.value })} /></label>
          <label>Due<input required value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} placeholder="Today, 3:30 PM" /></label>
        </div>
        <label>Working note<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <div className="inquiry-dialog-actions"><button className="primary-action" type="submit">Save sales update <Check size={17} /></button><button className="text-action" type="button" onClick={() => setForm({ ...form, actionStatus: "Completed" })}>Mark action complete</button></div>
      </form>
    </div>
  );
}

function AddInquiryDialog({ onAdd, onClose }) {
  const [form, setForm] = useState({ property: "", contact: "", email: "" });
  const submit = (event) => {
    event.preventDefault();
    if (!form.property.trim() || !form.contact.trim() || !form.email.trim()) return;
    onAdd({ id: Date.now(), ...form, stage: "New", activity: "Aug 28", next: "Review new enquiry", actionStatus: "Due today", due: "Today", detail: "Received Aug 28" });
    onClose();
  };
  return (
    <div className="dialog-backdrop">
      <form className="inquiry-dialog add-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close form"><X size={20} /></button>
        <p className="dashboard-eyebrow">New conversation</p><h2 id="add-dialog-title">Add enquiry</h2>
        <label>Property<input required value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} /></label>
        <label>Contact<input required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <button className="primary-action" type="submit">Add to enquiries <ArrowRight size={17} /></button>
      </form>
    </div>
  );
}

export function SalesDashboard({ cloudUser = null, onSignOut = null }) {
  const [activeView, setActiveView] = useState("home");
  const [inquiries, setInquiries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cinematic-flight-inquiries-v1")) || initialInquiries; } catch { return initialInquiries; }
  });
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [adding, setAdding] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [cloudMessage, setCloudMessage] = useState("");
  const title = useMemo(() => navItems.find((item) => item.id === activeView)?.label, [activeView]);

  useEffect(() => {
    const productName = import.meta.env.VITE_APP_MODE === "studio" ? "Cinematic Flight Studio" : "Cinematic Flight";
    document.title = `${title} — ${productName}`;
  }, [title]);
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") { setSelectedInquiry(null); setAdding(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => { localStorage.setItem("cinematic-flight-inquiries-v1", JSON.stringify(inquiries)); }, [inquiries]);
  useEffect(() => {
    if (!cloudUser) return undefined;
    let active = true;
    loadInquiries(cloudUser.id).then(async (remote) => {
      const next = remote.length ? remote : initialInquiries;
      if (!remote.length) await seedInquiries(cloudUser.id, initialInquiries);
      if (active) { setInquiries(next); setCloudMessage("Studio data synced"); }
    }).catch((error) => { if (active) setCloudMessage(`Cloud sync unavailable: ${error.message}`); });
    return () => { active = false; };
  }, [cloudUser]);
  useEffect(() => {
    if (!cloudMessage) return undefined;
    const timer = window.setTimeout(() => setCloudMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [cloudMessage]);

  const updateInquiry = (updated) => {
    const previous = inquiries.find((item) => item.id === updated.id);
    setInquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
    if (cloudUser) saveInquiry(cloudUser.id, updated).catch((error) => setCloudMessage(`Cloud save failed: ${error.message}`));
    if (updated.stage === "Won" && previous?.stage !== "Won") setCelebration({ id: Date.now(), property: updated.property });
  };
  const addInquiry = (inquiry) => {
    setInquiries((current) => [inquiry, ...current]);
    if (cloudUser) saveInquiry(cloudUser.id, inquiry).catch((error) => setCloudMessage(`Cloud save failed: ${error.message}`));
  };

  const common = { inquiries, openInquiry: setSelectedInquiry, openAdd: () => setAdding(true) };

  return (
    <div className="sales-dashboard">
      <Sidebar activeView={activeView} setActiveView={setActiveView} cloudUser={cloudUser} onSignOut={onSignOut} />
      <main className={`dashboard-main ${activeView === "documents" ? "is-property-files" : ""}`}>
        {activeView === "home" && <HomeView {...common} setActiveView={setActiveView} />}
        {activeView === "enquiries" && <EnquiriesView {...common} />}
        {activeView === "pipeline" && <PipelineView {...common} />}
        {activeView === "calendar" && <CalendarView {...common} />}
        {activeView === "documents" && <PropertyFilesView {...common} setActiveView={setActiveView} cloudUser={cloudUser} />}
      </main>
      {selectedInquiry && <InquiryDialog key={selectedInquiry.id} inquiry={selectedInquiry} onClose={() => setSelectedInquiry(null)} onUpdate={updateInquiry} />}
      {adding && <AddInquiryDialog onClose={() => setAdding(false)} onAdd={addInquiry} />}
      {celebration && <WinCelebration key={celebration.id} property={celebration.property} onComplete={() => setCelebration(null)} />}
      {cloudMessage && <div className="property-toast" role="status"><Check size={16} />{cloudMessage}</div>}
    </div>
  );
}
