import { useRef } from "react";
import { clamp, smoothstep } from "../journey/journey";
import { useJourneyTick } from "./useJourney";

export function ScrollHint() {
  const ref = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useJourneyTick((p) => {
    if (ref.current) {
      const o = smoothstep(0.3, 0.5, p) * (1 - smoothstep(0.55, 0.8, p));
      ref.current.style.opacity = String(clamp(o));
      ref.current.style.visibility = o < 0.01 ? "hidden" : "visible";
    }
    if (bar.current) {
      bar.current.style.transform = `scaleX(${clamp(p / 6).toFixed(4)})`;
      bar.current.style.opacity = String(clamp(smoothstep(0.08, 0.35, p) * (1 - smoothstep(5.6, 5.95, p))));
    }
  });

  return (
    <>
      <div className="scrollhint" ref={ref} aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" ref={bar} />
      </div>
    </>
  );
}
