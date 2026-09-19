import { useEffect, useRef, useState } from "react";
import { clamp, smoothstep } from "../journey/journey";
import { useJourneyTick } from "./useJourney";

/**
 * NYC AERIAL — scroll-scrubbed cinematic video.
 *
 * Replaces the procedural 3D environment that used to occupy scenes 03–04.
 * This is real aerial photography of Manhattan, and it is *scrubbed*: journey
 * progress maps directly to `video.currentTime`. It never plays on its own.
 *
 * Journey window
 *   2.00 ─ fade in over the Earth as the descent bottoms out
 *   2.00 → 4.10  scrub across the whole clip
 *   4.10 ─ fade out as the platform layer takes over
 *
 * Implementation notes that matter:
 *  - Seeking is coalesced. Setting `currentTime` every rAF overwhelms the
 *    decoder and the picture freezes, so a new seek is only issued once the
 *    previous one has retired (`seeking === false`) and the delta is
 *    meaningful. This is the single most important detail for smooth scrub.
 *  - The element is muted + playsInline + preload=auto so mobile Safari will
 *    decode frames without a user gesture, and we never call play().
 *  - A poster frame is painted underneath so there is no black flash before
 *    the first decode.
 */

const ENTER = 1.94;
const FULL = 2.16;
const HOLD_OUT = 4.02;
const EXIT = 4.26;

/** journey range that maps onto the clip's own timeline */
const SCRUB_FROM = 2.0;
const SCRUB_TO = 4.1;

/** Pick the encode once, at mount. Mobile gets the 480p/2.1 MB cut. */
function pickSource() {
  if (typeof window === "undefined") return "/video/nyc-aerial-720.mp4";
  const small = window.matchMedia("(max-width: 820px)").matches;
  const saveData = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection?.saveData;
  return small || saveData ? "/video/nyc-aerial-480.mp4" : "/video/nyc-aerial-720.mp4";
}

export function NYCVideoScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const src = useRef(pickSource()).current;

  const duration = useRef(0);
  const wanted = useRef(0);
  const applied = useRef(-1);
  const rafSeek = useRef(false);

  // Resolve duration as soon as metadata lands.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onMeta = () => {
      duration.current = Number.isFinite(v.duration) ? v.duration : 0;
      setReady(true);
      // paint the first frame immediately
      try {
        v.currentTime = 0.001;
      } catch {
        /* ignore */
      }
    };
    const onSeeked = () => {
      rafSeek.current = false;
    };

    if (v.readyState >= 1) onMeta();
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("seeked", onSeeked);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("seeked", onSeeked);
    };
  }, []);

  useJourneyTick((p) => {
    const wrap = wrapRef.current;
    const v = videoRef.current;
    if (!wrap) return;

    // ---- visibility -------------------------------------------------------
    const o = smoothstep(ENTER, FULL, p) * (1 - smoothstep(HOLD_OUT, EXIT, p));
    const vis = clamp(o);
    wrap.style.opacity = vis.toFixed(3);
    wrap.style.visibility = vis < 0.004 ? "hidden" : "visible";

    // A restrained scale drift keeps the frame alive at the edges of the
    // window without ever competing with the footage's own motion.
    const drift = 1.045 - 0.045 * clamp((p - SCRUB_FROM) / (SCRUB_TO - SCRUB_FROM));
    wrap.style.transform = `scale(${drift.toFixed(4)})`;

    if (!v || vis < 0.004 || !duration.current) return;

    // ---- scrub ------------------------------------------------------------
    const t = clamp((p - SCRUB_FROM) / (SCRUB_TO - SCRUB_FROM));
    wanted.current = t * (duration.current - 0.05);

    // Coalesce: never queue a seek while one is in flight.
    if (rafSeek.current || v.seeking) return;
    if (Math.abs(wanted.current - applied.current) < 0.02) return;

    applied.current = wanted.current;
    rafSeek.current = true;
    try {
      v.currentTime = wanted.current;
    } catch {
      rafSeek.current = false;
    }
  });

  return (
    <div
      ref={wrapRef}
      className="nyc-scene"
      style={{ opacity: 0, visibility: "hidden" }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="nyc-scene__video"
        muted
        playsInline
        preload="auto"
        // no autoplay, no loop — this element is driven only by scroll
        poster="/video/nyc-aerial-poster.jpg"
        tabIndex={-1}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className={`nyc-scene__grade${ready ? " is-ready" : ""}`} />
    </div>
  );
}
