import { useEffect, useRef, useState } from "react";
import { journey } from "../journey/journey";

/**
 * Imperative subscription to journey progress. Overlays mutate style directly
 * so the render loop never triggers React re-renders.
 */
export function useJourneyTick(cb: (p: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let id = 0;
    const loop = () => {
      ref.current(journey.p);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Coarse, throttled phase value for the rare cases React must know. */
export function useScenePhase() {
  const [phase, setPhase] = useState(journey.phase);
  useJourneyTick(() => {
    if (journey.phase !== phase) setPhase(journey.phase);
  });
  return phase;
}
