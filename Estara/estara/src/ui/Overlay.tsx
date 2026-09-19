import { Caption, Marker } from "./Caption";
import { EmergentLayer } from "./EmergentLayer";
import { PlatformPreview } from "./PlatformPreview";
import { Finale } from "./Finale";
import { ScrollHint } from "./ScrollHint";

/**
 * DOM overlay system — entirely separate from the WebGL world.
 * All timings are in journey space (scene N spans [N-1, N]).
 */
export function Overlay() {
  return (
    <div className="overlay" aria-live="polite">
      {/* ---------------------------------------------------- brand mark ---- */}
      <div className="brand">
        <Marker range={[0.12, 0.4, 5.28, 5.52]} text="ESTARA" className="marker--brand" />
      </div>

      {/* -------------------------------------- SCENE 01 — THE WORLD -------- */}
      <div className="stage stage--center">
        <Caption range={[0.14, 0.34, 0.44, 0.6]} text="Property begins with place." size="xl" />
        <Caption range={[0.6, 0.76, 0.88, 1.0]} text="Every journey starts somewhere." size="lg" />
      </div>

      {/* ------------------------------------ SCENE 02 — THE JOURNEY -------- */}
      <div className="stage stage--center">
        <Caption range={[1.02, 1.14, 1.16, 1.26]} text="The world is full of places." size="lg" />
        <Caption range={[1.24, 1.34, 1.4, 1.5]} text="Some feel like home." size="lg" />
        <Caption range={[1.48, 1.58, 1.66, 1.76]} text="Find the place that feels right." size="lg" />
      </div>
      <div className="stage stage--lower">
        <Marker range={[1.74, 1.86, 2.24, 2.4]} text="NEW YORK CITY · UNITED STATES" />
      </div>

      {/* --------------------------------- SCENE 03 — ARRIVAL ---------------
          Plays over the scrubbed Manhattan aerial. */}
      <div className="stage stage--center">
        <Caption range={[2.06, 2.18, 2.24, 2.34]} text="Every place tells a story." size="lg" />
        <Caption range={[2.34, 2.44, 2.5, 2.58]} text="From where you are…" size="lg" />
        <Caption range={[2.58, 2.66, 2.72, 2.8]} text="…to where you want to be." size="lg" />
      </div>
      <div className="stage stage--story">
        <Caption range={[2.84, 2.92, 2.96, 3.02]} text="A place of your own." size="xl" />
      </div>

      {/* ------------------------------- SCENE 04 — THE POSSIBILITY ---------
          Text is deliberately sparse and sits low, letting the aerial
          footage hold the frame. */}
      <div className="stage stage--story">
        <Caption
          range={[3.08, 3.18, 3.3, 3.4]}
          text="Finding the right place shouldn't be complicated."
          size="lg"
          tone="dark"
        />
        <Caption
          range={[3.42, 3.52, 3.6, 3.68]}
          text="Discover properties that fit the life you're building."
          size="lg"
          tone="dark"
        />
        <Caption
          range={[3.68, 3.76, 3.84, 3.9]}
          text="Connect with the people who can make it happen."
          size="lg"
          tone="dark"
        />
        <Caption
          range={[3.9, 3.96, 4.06, 4.16]}
          text="Estara connects you to places worth calling home."
          size="xl"
          tone="dark"
        />
      </div>

      {/* concept markers, offset from centre so they read against the city */}
      <div className="concepts">
        <Marker range={[3.16, 3.26, 3.98, 4.14]} text="DISCOVER" className="concept concept--a" />
        <Marker range={[3.48, 3.58, 4.0, 4.16]} text="CONNECT" className="concept concept--b" />
        <Marker range={[3.74, 3.84, 4.02, 4.18]} text="MOVE FORWARD" className="concept concept--c" />
      </div>

      {/* -------------------------------- SCENE 05 — THE PLATFORM -----------
          The interface emerges from the environment: near-invisible glass at
          4.28, fully solid product UI by 5.0. */}
      <div className="stage stage--story">
        <Caption
          range={[4.1, 4.2, 4.34, 4.46]}
          text="One place to discover what comes next."
          size="xl"
          tone="dark"
        />
      </div>

      <EmergentLayer emerge={[4.28, 4.62, 4.62, 5.02]} exit={[5.22, 5.5]} className="platform-layer">
        <PlatformPreview />
      </EmergentLayer>

      <div className="stage stage--lower stage--tagline">
        <Marker range={[4.86, 4.98, 5.2, 5.38]} text="PROPERTIES · PEOPLE · POSSIBILITIES" />
      </div>

      {/* ------------------------------- SCENE 06 — YOUR NEXT MOVE ---------- */}
      <Finale />

      <ScrollHint />
    </div>
  );
}
