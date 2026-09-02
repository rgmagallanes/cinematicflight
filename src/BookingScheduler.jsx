import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  Clock,
  EnvelopeSimple,
  ImageSquare,
  Sparkle,
  UserCircle,
} from "@phosphor-icons/react";

const purposes = [
  { id: "reading", label: "Photograph reading", icon: ImageSquare },
  { id: "website", label: "New property website", icon: CalendarBlank },
  { id: "cinematic", label: "Add the cinematic experience", icon: Sparkle },
];

const availableDays = [3, 4, 8, 10, 15, 17, 22, 24, 25, 29];
const timeSlots = ["9:30 AM", "11:00 AM", "2:30 PM", "4:00 PM"];
const calendarDays = [
  { day: 30, outside: true }, { day: 31, outside: true },
  ...Array.from({ length: 30 }, (_, index) => ({ day: index + 1, outside: false })),
  { day: 1, outside: true }, { day: 2, outside: true }, { day: 3, outside: true },
];

function formatDate(day) {
  const date = new Date(2026, 8, day);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

function createRequestId() {
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `booking_${unique.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function bookingWindow(day, time) {
  const [, hourText, minuteText, period] = time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/) || [];
  let hour = Number(hourText);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const minute = Number(minuteText);
  const pad = (value) => String(value).padStart(2, "0");
  const start = `2026-09-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`;
  const endMinutes = hour * 60 + minute + 30;
  const end = `2026-09-${pad(day)}T${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}:00+08:00`;
  return { start, end };
}

export function BookingScheduler() {
  const [identity, setIdentity] = useState({ name: "", property: "", email: "" });
  const [draftIdentity, setDraftIdentity] = useState(identity);
  const [identityErrors, setIdentityErrors] = useState({});
  const [editingIdentity, setEditingIdentity] = useState(true);
  const [purpose, setPurpose] = useState("reading");
  const [day, setDay] = useState(4);
  const [time, setTime] = useState("11:00 AM");
  const [step, setStep] = useState("schedule");
  const [requestId, setRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const purposeLabel = useMemo(() => purposes.find((item) => item.id === purpose)?.label || purposes[0].label, [purpose]);
  const selectedDate = formatDate(day);

  const saveIdentity = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!draftIdentity.name.trim()) nextErrors.name = "Enter your name to continue.";
    if (!draftIdentity.email.trim()) nextErrors.email = "Enter your email address to continue.";
    else if (!/^\S+@\S+\.\S+$/.test(draftIdentity.email.trim())) nextErrors.email = "Enter a valid email address, such as name@example.com.";
    setIdentityErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIdentity({ ...draftIdentity, name: draftIdentity.name.trim(), property: draftIdentity.property.trim(), email: draftIdentity.email.trim() });
    setRequestId("");
    setEditingIdentity(false);
  };

  const confirmBooking = async () => {
    setSubmitting(true);
    setSubmitError("");
    const stableRequestId = requestId || createRequestId();
    if (!requestId) setRequestId(stableRequestId);
    const { start, end } = bookingWindow(day, time);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: stableRequestId, name: identity.name, email: identity.email, property: identity.property, purpose: purposeLabel, start, end, timezone: "Asia/Manila", website: "" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) throw new Error("That time is no longer available. Return to the calendar and choose another time.");
        if (response.status === 429) throw new Error("Too many booking attempts were made. Please wait ten minutes and try again.");
        if (response.status === 503) throw new Error("Online booking is not configured yet. Please contact Cinematic Flight directly for now.");
        throw new Error(result.message || result.errors?.[0] || "The booking could not be completed. Please try again.");
      }
      setReceipt(result);
      setStep("confirmed");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The booking could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "confirmed") {
    return (
      <main className="booking-shell booking-finish">
        <section className="booking-finish-panel" aria-labelledby="booking-confirmed-title">
          <img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight" />
          <Check size={36} weight="bold" aria-hidden="true" />
          <h1 id="booking-confirmed-title">Your conversation is held.</h1>
          <p>{selectedDate} at {time}, shown in Asia/Manila.</p>
          <p className="booking-confirmation-note" role="status">A calendar event and confirmation email have been requested{receipt?.requestId ? ` · Reference ${receipt.requestId}` : ""}.</p>
          <button type="button" onClick={() => { setRequestId(""); setReceipt(null); setStep("schedule"); }}>Book another conversation</button>
        </section>
      </main>
    );
  }

  if (step === "review") {
    return (
      <main className="booking-shell booking-review">
        <header className="booking-topbar">
          <a href="/" aria-label="Cinematic Flight home"><img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight" /></a>
          <button type="button" onClick={() => setStep("schedule")}><ArrowLeft size={18} /> Back to calendar</button>
        </header>
        <section className="booking-review-grid">
          <div>
            <h1>Review your conversation.</h1>
            <p>Check the details before sending this booking.</p>
          </div>
          <dl>
            <div><dt>Prospect</dt><dd>{identity.name}<small>{identity.property ? `${identity.property} · ` : ""}{identity.email}</small></dd></div>
            <div><dt>Conversation</dt><dd>{purposeLabel}</dd></div>
            <div><dt>Date and time</dt><dd>{selectedDate}<small>{time} · Asia/Manila · 30 minutes</small></dd></div>
          </dl>
          <div className="booking-review-actions">
            {submitError && <p className="booking-submit-error" role="alert">{submitError}</p>}
            <button className="booking-primary" type="button" onClick={confirmBooking} disabled={submitting} aria-busy={submitting}>{submitting ? "Confirming…" : "Confirm booking"} {!submitting && <ArrowRight size={18} />}</button>
            <p>Availability is checked before the calendar event is created.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-shell">
      <aside className="booking-intro">
        <a className="booking-logo" href="/" aria-label="Cinematic Flight home"><img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight" /></a>
        <div className="booking-intro-copy">
          <p>A conversation about your property</p>
          <h1>Let’s find the right moment.</h1>
          <span>Choose a focused time to discuss the photographs, the website, and what the property experience could become.</span>
        </div>
        <ul className="booking-expectations" aria-label="What to expect">
          <li><Clock size={23} /><span>30 focused minutes</span></li>
          <li><ImageSquare size={23} /><span>Your photographs are optional</span></li>
          <li><EnvelopeSimple size={23} /><span>A confirmation will be emailed</span></li>
        </ul>
        <div className="booking-identity">
          <UserCircle size={46} weight="thin" />
          <div><strong>{identity.name || "Prospect details"}</strong><span>{identity.property || identity.email || "Name and email required"}</span></div>
          {!editingIdentity && <button type="button" onClick={() => { setDraftIdentity(identity); setIdentityErrors({}); setEditingIdentity(true); }}>Change details</button>}
        </div>
      </aside>

      <section className="booking-calendar" aria-label="Schedule a conversation">
        {editingIdentity ? (
          <form className="booking-identity-form" onSubmit={saveIdentity} noValidate>
            <div><h2>Tell us who is booking.</h2><p>Your name and email are used to arrange and confirm the conversation.</p></div>
            <label>Your name <span>Required</span><input required maxLength={100} autoComplete="name" aria-invalid={Boolean(identityErrors.name)} aria-describedby={identityErrors.name ? "booking-name-error" : undefined} value={draftIdentity.name} onChange={(event) => { setDraftIdentity({ ...draftIdentity, name: event.target.value }); setIdentityErrors({ ...identityErrors, name: "" }); }} />{identityErrors.name && <small className="booking-field-error" id="booking-name-error">{identityErrors.name}</small>}</label>
            <label>Property or business <span>Optional</span><input maxLength={160} autoComplete="organization" value={draftIdentity.property} onChange={(event) => setDraftIdentity({ ...draftIdentity, property: event.target.value })} /></label>
            <label>Email address <span>Required</span><input required maxLength={254} autoComplete="email" type="email" aria-invalid={Boolean(identityErrors.email)} aria-describedby={identityErrors.email ? "booking-email-error" : undefined} value={draftIdentity.email} onChange={(event) => { setDraftIdentity({ ...draftIdentity, email: event.target.value }); setIdentityErrors({ ...identityErrors, email: "" }); }} />{identityErrors.email && <small className="booking-field-error" id="booking-email-error">{identityErrors.email}</small>}</label>
            <div className="booking-form-actions"><button className="booking-primary" type="submit">Continue to calendar <ArrowRight size={18} /></button>{identity.name && <button type="button" onClick={() => { setDraftIdentity(identity); setIdentityErrors({}); setEditingIdentity(false); }}>Cancel</button>}</div>
          </form>
        ) : (
          <>
            <fieldset className="booking-purpose">
              <legend>What would you like to discuss?</legend>
              <div>
                {purposes.map(({ id, label, icon: Icon }) => (
                  <label className={purpose === id ? "is-selected" : ""} key={id}>
                    <input type="radio" name="booking-purpose" value={id} checked={purpose === id} onChange={() => { setPurpose(id); setRequestId(""); setSubmitError(""); }} />
                    <Icon size={28} weight="thin" /><span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="booking-month" aria-labelledby="booking-month-heading">
              <header><button type="button" aria-label="Previous month">‹</button><h2 id="booking-month-heading">September 2026</h2><button type="button" aria-label="Next month">›</button></header>
              <div className="booking-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label}>{label}</span>)}</div>
              <div className="booking-days">
                {calendarDays.map((item, index) => {
                  const enabled = !item.outside && availableDays.includes(item.day);
                  const isToday = !item.outside && item.day === 1;
                  return <button type="button" key={`${item.day}-${index}`} disabled={!enabled} className={`${item.outside ? "is-outside" : ""} ${day === item.day && !item.outside ? "is-selected" : ""}`} onClick={() => { setDay(item.day); setRequestId(""); setSubmitError(""); }} aria-label={`${item.outside ? "Adjacent month" : "September"} ${item.day}${isToday ? ", today" : ""}`}><span>{item.day}</span>{isToday && <small>Today</small>}</button>;
                })}
              </div>
            </section>

            <fieldset className="booking-times">
              <legend>Choose a time on {formatDate(day).replace(", 2026", "")}</legend>
              <div>{timeSlots.map((slot) => <label className={time === slot ? "is-selected" : ""} key={slot}><input type="radio" name="booking-time" checked={time === slot} onChange={() => { setTime(slot); setRequestId(""); setSubmitError(""); }} /><span>{slot}</span></label>)}</div>
            </fieldset>

            <footer className="booking-selection">
              <CalendarBlank size={30} weight="thin" />
              <div><span>Your selection</span><strong>{formatDate(day).replace(", 2026", "")} · {time} · Asia/Manila</strong></div>
              <button className="booking-primary" type="button" onClick={() => setStep("review")}>Review and confirm</button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
