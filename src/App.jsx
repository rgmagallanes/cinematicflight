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

    const loadAround = (index) => {
      [index - 1, index, index + 1].forEach((videoIndex) => {
        const video = videosRef.current[videoIndex];
        if (!video || video.preload !== "none") return;
        video.preload = "metadata";
        video.load();
      });
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

      const clampedTarget = Math.min(video.duration - 0.025, Math.max(0, target));
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
              preload={index === 0 ? "metadata" : "none"}
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
      <button className="submit-button field-wide" type="submit">Discuss your property</button>
      <small className="field-wide form-note">Prototype only — no details are sent or stored.</small>
    </form>
  );
}

export function App() {
  return (
    <main id="top">
      <FlightHero />

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
          <a className="solid-action" href="#contact">Discuss your property</a>
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
        <p>Existing website or complete rebuild.</p>
        <h2>The journey meets the property where it is.</h2>
        <div className="method-content">
          <p className="method-note">
            Add it as a cinematic opening to an established site, or let it lead an entirely new experience. Booking and enquiry routes remain connected.
          </p>
          <ol className="process-list">
            <li><strong>Share the place</strong><span>Send the property and the photographs already available.</span></li>
            <li><strong>Shape the sequence</strong><span>We assess whether the imagery can support a convincing journey.</span></li>
            <li><strong>Connect the destination</strong><span>The experience can lead into the existing website or a complete rebuild.</span></li>
          </ol>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-copy">
          <h2>Begin with the place.</h2>
          <p>Share the property and the photographs you have. We’ll start with whether the journey is possible.</p>
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
