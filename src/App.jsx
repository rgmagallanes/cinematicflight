import { useEffect, useRef, useState } from "react";
import "@fontsource/bodoni-moda/400.css";

const scenes = [
  "The grounds",
  "The water",
  "The pavilion",
  "The threshold",
  "The table",
  "The room",
  "The stillness",
];

const clips = Array.from({ length: 6 }, (_, index) => ({
  desktopSrc: `/assets/flight/desktop/f${index + 1}.mp4`,
  mobileSrc: `/assets/flight/f${index + 1}.mp4`,
  poster: `/assets/flight/poster${index + 1}.jpg`,
}));

function FlightHero() {
  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const videosRef = useRef([]);
  const activeVideoRef = useRef(0);
  const activeSceneRef = useRef(0);
  const [activeVideo, setActiveVideo] = useState(0);
  const [activeScene, setActiveScene] = useState(0);
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    const shell = shellRef.current;
    const stage = stageRef.current;
    if (!shell || !stage) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
    const targetTimes = Array(clips.length).fill(null);
    let frame = 0;

    // Scroll scrubbing seeks on every frame. If the target byte range is not
    // already downloaded each seek opens a range request that the next frame
    // aborts, so nothing ever arrives. Buffer whole clips up front instead.
    const startBuffering = (videoIndex) => {
      const video = videosRef.current[videoIndex];
      if (!video || video.preload === "auto") return;
      video.preload = "auto";
      video.load();
    };

    const bufferedThrough = (video) => {
      if (!video?.buffered?.length) return 0;
      // Sequential download from zero, so only the range covering the start
      // tells us how far the clip can be scrubbed without a new request.
      for (let range = 0; range < video.buffered.length; range += 1) {
        if (video.buffered.start(range) <= 0.05) return video.buffered.end(range);
      }
      return 0;
    };

    const isBuffered = (video) => {
      if (!Number.isFinite(video?.duration) || video.duration <= 0) return false;
      return bufferedThrough(video) >= video.duration - 0.15;
    };

    const loadAround = (index) => {
      startBuffering(index);
      // Stage the neighbour so two full-rate downloads never split the pipe:
      // the clip on screen has to win.
      if (isBuffered(videosRef.current[index])) startBuffering(index + 1);
    };

    const primeCurrent = () => {
      videosRef.current.forEach((video) => {
        if (!video || video.preload === "none") return;
        const attempt = video.play();
        if (attempt?.then) attempt.then(() => video.pause()).catch(() => {});
      });
    };

    const commitLatestSeek = (index) => {
      const video = videosRef.current[index];
      const target = targetTimes[index];
      if (
        !video
        || video.seeking
        || !Number.isFinite(target)
        || !Number.isFinite(video.duration)
        || video.duration <= 0
      ) return;

      // Never seek past what has arrived. Riding the buffer edge keeps the
      // flight moving as fast as the network allows instead of stalling on a
      // stale frame, and never asks for bytes that are not already here.
      const reachable = Math.max(0, bufferedThrough(video) - 0.05);
      const clampedTarget = Math.min(
        video.duration - 0.025,
        reachable,
        Math.max(0, target),
      );
      const threshold = coarsePointer.matches ? 0.02 : 0.008;
      if (Math.abs(video.currentTime - clampedTarget) <= threshold) return;

      try {
        video.currentTime = clampedTarget;
      } catch {
        // Metadata can become temporarily unavailable while the source changes.
      }
    };

    const render = () => {
      const rect = shell.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = reduced.matches
        ? 0
        : Math.min(1, Math.max(0, -rect.top / distance));
      const scaled = Math.min(clips.length - 0.0001, progress * clips.length);
      const nextActiveVideo = Math.floor(scaled);
      const nextActiveScene = progress < 0.025
        ? 0
        : Math.min(scenes.length - 1, nextActiveVideo + 1);
      const local = scaled - nextActiveVideo;
      const video = videosRef.current[nextActiveVideo];

      if (nextActiveVideo !== activeVideoRef.current) {
        activeVideoRef.current = nextActiveVideo;
        setActiveVideo(nextActiveVideo);
      }

      if (nextActiveScene !== activeSceneRef.current) {
        activeSceneRef.current = nextActiveScene;
        setActiveScene(nextActiveScene);
      }

      loadAround(nextActiveVideo);

      if (video?.duration && Number.isFinite(video.duration)) {
        targetTimes[nextActiveVideo] = local * video.duration;
        commitLatestSeek(nextActiveVideo);
      }

      stage.style.setProperty("--flight-progress", progress.toFixed(4));
      stage.style.setProperty(
        "--video-opacity",
        Math.min(1, progress / 0.025).toFixed(3),
      );
      stage.style.setProperty(
        "--intro-opacity",
        Math.max(0, 1 - progress / 0.18).toFixed(3),
      );
      stage.style.setProperty(
        "--scene-opacity",
        Math.min(1, Math.max(0, (progress - 0.08) / 0.08)).toFixed(3),
      );
    };

    const requestRender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    const mediaListeners = videosRef.current.map((video, index) => {
      const onSeeked = () => commitLatestSeek(index);
      video?.addEventListener("seeked", onSeeked);
      video?.addEventListener("loadedmetadata", requestRender);
      video?.addEventListener("durationchange", requestRender);
      video?.addEventListener("progress", requestRender);
      video?.addEventListener("canplaythrough", requestRender);
      return { video, onSeeked };
    });

    loadAround(0);
    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    window.addEventListener("pointerdown", primeCurrent, { once: true });
    window.addEventListener("keydown", primeCurrent, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      window.removeEventListener("pointerdown", primeCurrent);
      window.removeEventListener("keydown", primeCurrent);
      mediaListeners.forEach(({ video, onSeeked }) => {
        video?.removeEventListener("seeked", onSeeked);
        video?.removeEventListener("loadedmetadata", requestRender);
        video?.removeEventListener("durationchange", requestRender);
        video?.removeEventListener("progress", requestRender);
        video?.removeEventListener("canplaythrough", requestRender);
      });
    };
  }, []);

  const enterJourney = () => {
    window.scrollTo({ top: window.innerHeight * 0.86, behavior: "smooth" });
  };

  return (
    <section className="flight-shell" ref={shellRef} aria-label="Good Food Farm cinematic journey">
      <div className="flight-stage" ref={stageRef}>
        <div className="flight-media" aria-hidden="true">
          <picture className="flight-fallback">
            <source srcSet="/assets/property/good-food-farm-overview-1778.avif" type="image/avif" />
            <img src="/assets/property/good-food-farm-overview-1778.png" alt="" />
          </picture>
          {clips.map((clip, index) => (
            <video
              className={`flight-clip ${activeVideo === index ? "is-active" : ""}`}
              key={clip.desktopSrc}
              ref={(node) => {
                videosRef.current[index] = node;
              }}
              poster={clip.poster}
              preload={index === 0 ? "auto" : "none"}
              muted
              playsInline
              onLoadedMetadata={() => setReadyCount((count) => count + 1)}
            >
              <source media="(min-width: 900px)" src={clip.desktopSrc} type="video/mp4" />
              <source src={clip.mobileSrc} type="video/mp4" />
            </video>
          ))}
          <div className="flight-shade" />
        </div>

        <a className="skip-link" href="#offer">Skip the cinematic journey</a>

        <header className="site-nav">
          <a className="wordmark brand-lockup" href="#top" aria-label="Cinematic Flight home">
            <img
              className="brand-logo"
              src="/assets/brand/cinematic-flight-logo-concept-v1.png"
              alt=""
              width="2172"
              height="724"
            />
            <span className="brand-tagline">Property websites in motion</span>
          </a>
          <nav aria-label="Primary navigation">
            <a href="#work">Selected work</a>
            <a href="#offer">The service</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <div className="hero-copy">
          <h1 className="hero-service-title">
            You provide the place.<br />
            We create the <span>website</span><br />
            and the <span>cinematic<br />experience.</span>
          </h1>
          <div className="hero-entry">
            <button className="enter-button" type="button" onClick={enterJourney}>
              Enter
            </button>
            <div className="hero-intro">
              <p>Built from real photographs of the property.</p>
              <a href="#offer">See the service</a>
            </div>
          </div>
        </div>

        <div className="scene-copy" aria-live="polite">
          <span className="sr-only">Scene {activeScene + 1} of {scenes.length}: </span>
          <strong>{scenes[activeScene]}</strong>
        </div>

        <div className="edge-rail" aria-hidden="true"><span>Scroll</span><i /></div>
        <p className="property-signature">Good Food Farm</p>

        <div className="flight-status">
          <span aria-label={`Scene ${activeScene + 1} of ${scenes.length}`}>
            {String(activeScene + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
          </span>
          <div className="progress-track" aria-hidden="true">
            <i />
            {scenes.map((scene) => <b key={scene} />)}
          </div>
        </div>

        <p className={`load-note ${readyCount > 0 ? "is-ready" : ""}`}>
          {readyCount > 0 ? "Scroll to move through the property" : "Preparing the journey"}
        </p>
      </div>
    </section>
  );
}

function InquiryForm() {
  const [values, setValues] = useState({ name: "", email: "", property: "" });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const fields = [
    { name: "name", label: "Your name", autoComplete: "name" },
    { name: "email", label: "Email address", autoComplete: "email", type: "email" },
    { name: "property", label: "Property or website", placeholder: "Name or URL", wide: true },
  ];

  const validate = () => {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = "Enter your name.";
    if (!values.email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = "Enter a complete email address.";
    }
    if (!values.property.trim()) nextErrors.property = "Enter the property name or website.";
    return nextErrors;
  };

  if (submitted) {
    return (
      <div className="form-success" role="status">
        <p>Thank you. The prototype enquiry flow is working.</p>
        <button
          type="button"
          onClick={() => {
            setValues({ name: "", email: "", property: "" });
            setErrors({});
            setSubmitted(false);
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="inquiry-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const nextErrors = validate();
        if (Object.keys(nextErrors).length > 0) {
          setErrors(nextErrors);
          requestAnimationFrame(() => {
            document.getElementById(`inquiry-${Object.keys(nextErrors)[0]}`)?.focus();
          });
          return;
        }
        setSubmitted(true);
      }}
    >
      {fields.map((field) => {
        const errorId = `inquiry-${field.name}-error`;
        return (
          <label className={field.wide ? "field-wide" : undefined} key={field.name}>
            <span>{field.label}</span>
            <input
              id={`inquiry-${field.name}`}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              value={values[field.name]}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={errors[field.name] ? errorId : undefined}
              onChange={(event) => {
                const value = event.target.value;
                setValues((current) => ({ ...current, [field.name]: value }));
                if (errors[field.name]) {
                  setErrors((current) => ({ ...current, [field.name]: undefined }));
                }
              }}
            />
            {errors[field.name] && (
              <small className="field-error" id={errorId} role="alert">
                {errors[field.name]}
              </small>
            )}
          </label>
        );
      })}
      <button className="submit-button field-wide" type="submit">Ask for the reading</button>
      <small className="field-wide form-note">Prototype only — no details are sent or stored.</small>
    </form>
  );
}

export function App() {
  return (
    <main id="top">
      <FlightHero />

      <section className="problem-section">
        <h2>Your place is better than your website.</h2>
        <div className="problem-copy">
          <p>
            Most property websites were built to list rooms and rates. They present a place the way a catalogue does — a grid of thumbnails in a layout a hundred other properties are already using.
          </p>
          <p className="problem-turn">
            The photographs are usually good. It is the website that flattens them.
          </p>
          <p>
            Someone choosing where to stay is trying to feel a place before they commit to it. A gallery asks them to imagine it instead.
          </p>
        </div>

        <figure className="flattening">
          <div className="flattening-run">
            {[0, 1, 2, 3, 4].map((step) => (
              <div className="flattening-step" key={step} style={{ "--step": step }}>
                <picture>
                  <source srcSet="/assets/property/good-food-farm-overview-1778.avif" type="image/avif" />
                  <img
                    src="/assets/property/good-food-farm-overview-1778.png"
                    alt={step === 0 ? "Good Food Farm seen in full" : ""}
                    loading="lazy"
                  />
                </picture>
              </div>
            ))}
          </div>
          <figcaption>The same view, reduced step by step to fit a template.</figcaption>
        </figure>
      </section>

      <section className="contrast-section">
        <div className="contrast-heading">
          <h2>One set of photographs. Two outcomes.</h2>
          <p>The same Good Food Farm images, treated two ways.</p>
        </div>

        <div className="contrast-pair">
          <article className="contrast-side">
            <h3>As a gallery</h3>
            <div className="contrast-gallery" aria-label="The same photographs shown as a conventional thumbnail grid">
              {[1, 2, 3, 4, 5, 6].map((number) => (
                <img
                  key={number}
                  src={`/assets/flight/poster${number}.jpg`}
                  alt=""
                  loading="lazy"
                />
              ))}
            </div>
            <p>Thumbnails in a grid. The visitor scans, compares, and leaves to compare somewhere else.</p>
          </article>

          <article className="contrast-side">
            <h3>As a flight</h3>
            <div className="contrast-flight" aria-label="The same photographs given depth and sequence">
              {[1, 3, 5].map((number, index) => (
                <figure key={number} style={{ "--depth": 2 - index }}>
                  <img src={`/assets/flight/poster${number}.jpg`} alt="" loading="lazy" />
                </figure>
              ))}
            </div>
            <p>The same images, given depth and sequence. The visitor moves through the property instead of scanning it.</p>
          </article>
        </div>

        <p className="contrast-note">
          Nothing was re-shot. The difference is what the website does with the material.
        </p>
      </section>

      <section className="offer-section" id="offer">
        <header className="creation-heading">
          <h2>How your property website is created</h2>
        </header>

        <ol className="creation-stages" aria-label="How Cinematic Flight works">
          <li className="creation-stage">
            <div className="stage-copy">
              <span>01</span>
              <h3>Your property</h3>
              <p>We select real photographs that show the character and flow of the place.</p>
            </div>
            <div className="photo-stack" aria-label="Selected Good Food Farm photographs">
              {[1, 3, 5, 7, 6].map((number, index) => (
                <img
                  key={number}
                  src={`/assets/flight/poster${number}.jpg`}
                  alt={`Selected Good Food Farm view ${index + 1}`}
                  loading="lazy"
                />
              ))}
            </div>
          </li>

          <li className="creation-stage">
            <div className="stage-copy">
              <span>02</span>
              <h3>The cinematic view</h3>
              <p>We turn those photographs into a scroll-controlled journey through the property.</p>
            </div>
            <div className="flight-stack" aria-label="Photographs connected into a cinematic sequence">
              {[1, 3, 5, 7, 6].map((number, index) => (
                <figure key={number}>
                  <img
                    src={`/assets/flight/poster${number}.jpg`}
                    alt={`Cinematic sequence scene ${index + 1}`}
                    loading="lazy"
                  />
                  <figcaption>{String(index + 1).padStart(2, "0")}</figcaption>
                </figure>
              ))}
            </div>
          </li>

          <li className="creation-stage">
            <div className="stage-copy">
              <span>03</span>
              <h3>The complete website</h3>
              <p>We design and build the website around that journey, then connect its enquiry or booking route.</p>
            </div>
            <div className="website-preview" aria-label="Example of the cinematic journey inside a property website">
              <div className="website-preview-bar">
                <span>Cinematic Flight</span>
                <span>Property website</span>
              </div>
              <div className="website-preview-hero">
                <img src="/assets/property/good-food-farm-overview-1778.avif" alt="Good Food Farm surrounded by forest" loading="lazy" />
                <div>
                  <small>Good Food Farm</small>
                  <strong>A website you can enter.</strong>
                </div>
              </div>
              <div className="website-preview-footer">
                <strong>The place, experienced before arrival.</strong>
                <span>Responsive on desktop and mobile</span>
              </div>
            </div>
          </li>
        </ol>

        <div className="delivery-choice" aria-label="Ways to add Cinematic Flight">
          <p>Add the cinematic view to your current website</p>
          <span>or</span>
          <p>Create a complete new property website</p>
        </div>

        <div className="offer-close">
          <p>Designed for desktop and mobile</p>
          <a className="solid-action" href="#contact">See what your property would look like</a>
        </div>
      </section>

      <section className="proof-section" id="work">
        <div className="proof-heading">
          <h2>The place is the proof.</h2>
          <div className="proof-copy">
            <p>
              Real photographs establish every destination. The movement between them turns a familiar gallery into an arrival.
            </p>
            <dl className="project-facts">
              <div><dt>Working demonstration</dt><dd>Good Food Farm</dd></div>
              <div><dt>Source</dt><dd>Existing property photographs</dd></div>
              <div><dt>Format</dt><dd>Responsive, scroll-controlled journey</dd></div>
            </dl>
          </div>
        </div>
        <div className="frame-run" aria-label="Good Food Farm journey frames">
          {[1, 3, 5, 7].map((number, index) => (
            <figure key={number}>
              <img
                src={`/assets/flight/poster${number}.jpg`}
                alt={`Good Food Farm journey view ${index + 1}`}
                loading="lazy"
              />
              <figcaption>{String(index + 1).padStart(2, "0")}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="method-section">
        <p>No new photography required.</p>
        <h2>You already have the material.</h2>
        <div className="method-content">
          <p className="method-note">
            The journey is built from photographs the property already has — the ones on your current website, in your brochure, in the folder from the last shoot.
          </p>
          <ol className="process-list">
            <li><strong>Send what exists</strong><span>Whatever is already published, plus anything that never made it onto the site.</span></li>
            <li><strong>We read the material</strong><span>Whether the imagery can carry a convincing journey, answered before anything is built.</span></li>
            <li><strong>Gaps are named</strong><span>If a view is missing, we say which one, rather than commissioning a production around it.</span></li>
          </ol>
          <div className="method-offer">
            <p>That reading is where every project starts, and it costs you nothing to ask for it.</p>
            <a className="solid-action" href="#contact">Ask what your photographs can do</a>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-copy">
          <h2>Start with a reading.</h2>
          <p>Send the property and the photographs you already have. We’ll tell you whether they can carry a flight, and what it would take — before anything is designed or agreed.</p>
          <a className="contact-booking-link" href="/book">Prefer to talk? Book a conversation <span aria-hidden="true">→</span></a>
        </div>
        <InquiryForm />
      </section>

      <footer>
        <a className="wordmark" href="#top">Cinematic Flight</a>
        <p>Property websites in motion.</p>
        <a href="#top">Back to the beginning</a>
      </footer>
    </main>
  );
}
