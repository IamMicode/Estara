import { useEffect, useState } from "react";
import { CinematicCanvas } from "./webgl/CinematicCanvas";
import { Overlay } from "./ui/Overlay";
import { NYCVideoScene } from "./ui/NYCVideoScene";
import { initJourney, journey, SCENE_COUNT } from "./journey/journey";
import "./styles.css";

/** vh of scroll track allocated to each scene */
const TRACK_VH = 260;

export default function App() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const read = initJourney();
    // scroll restoration must not drop the visitor mid-journey
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    read();
    journey.ready = true;
    const t = window.setTimeout(() => setEntered(true), 420);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <div className="world" aria-hidden="true">
        <CinematicCanvas />
      </div>

      {/* Real aerial footage of Manhattan, scrubbed by scroll. Sits above the
          WebGL world and below the typographic overlay. */}
      <NYCVideoScene />

      <Overlay />

      {/* scroll tracks: one per scene */}
      <div className="tracks" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <section key={i} className="track" style={{ height: `${TRACK_VH}vh` }} />
        ))}
      </div>

      <div className={`veil ${entered ? "veil--gone" : ""}`} aria-hidden="true" />

      {/* Accessible, non-animated summary of the story for assistive tech
          and reduced-motion users who never scroll. */}
      <div className="sr-only">
        <h1>Estara — where places become possibilities</h1>
        <p>
          Estara connects you to places worth calling home. Discover properties, connect with
          agents, and take your next step. Choose to continue as a customer looking for a
          property, or as an agent listing one.
        </p>
      </div>
    </>
  );
}
