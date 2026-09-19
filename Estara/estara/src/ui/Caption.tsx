import { useRef } from "react";
import { clamp, smoothstep } from "../journey/journey";
import { useJourneyTick } from "./useJourney";

export interface CaptionSpec {
  /** journey-space window: [in start, in end, out start, out end] */
  range: [number, number, number, number];
  text: string;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "center" | "left";
  tone?: "light" | "dark";
}

/**
 * One cinematic line. Opacity + subtle translateY only.
 * Style is mutated imperatively — no React state in the animation loop.
 */
export function Caption({ range, text, size = "md", align = "center", tone = "light" }: CaptionSpec) {
  const ref = useRef<HTMLParagraphElement>(null);

  useJourneyTick((p) => {
    const el = ref.current;
    if (!el) return;
    const [a, b, c, d] = range;
    const o = smoothstep(a, b, p) * (1 - smoothstep(c, d, p));
    const y = (1 - smoothstep(a, b, p)) * 18 - smoothstep(c, d, p) * 14;
    el.style.opacity = String(clamp(o));
    el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    el.style.visibility = o < 0.004 ? "hidden" : "visible";
  });

  return (
    <p
      ref={ref}
      className={`caption caption--${size} caption--${align} caption--${tone}`}
      style={{ opacity: 0, visibility: "hidden" }}
    >
      {text}
    </p>
  );
}

/** Small tracked label (DISCOVER / CONNECT / MOVE FORWARD, brand mark, etc.) */
export function Marker({
  range,
  text,
  className = "",
}: {
  range: [number, number, number, number];
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useJourneyTick((p) => {
    const el = ref.current;
    if (!el) return;
    const [a, b, c, d] = range;
    const o = smoothstep(a, b, p) * (1 - smoothstep(c, d, p));
    el.style.opacity = String(clamp(o));
    el.style.transform = `translate3d(0, ${((1 - smoothstep(a, b, p)) * 10).toFixed(2)}px, 0)`;
    el.style.visibility = o < 0.004 ? "hidden" : "visible";
  });
  return (
    <span ref={ref} className={`marker ${className}`} style={{ opacity: 0, visibility: "hidden" }}>
      {text}
    </span>
  );
}

/** Generic fading panel wrapper for larger UI blocks (platform, role choice). */
export function FadeLayer({
  range,
  children,
  className = "",
  lift = 26,
}: {
  range: [number, number, number, number];
  children: React.ReactNode;
  className?: string;
  lift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useJourneyTick((p) => {
    const el = ref.current;
    if (!el) return;
    const [a, b, c, d] = range;
    const o = smoothstep(a, b, p) * (1 - smoothstep(c, d, p));
    el.style.opacity = String(clamp(o));
    el.style.transform = `translate3d(0, ${((1 - smoothstep(a, b, p)) * lift).toFixed(2)}px, 0)`;
    el.style.visibility = o < 0.004 ? "hidden" : "visible";
    el.style.pointerEvents = o > 0.85 ? "auto" : "none";
  });
  return (
    <div ref={ref} className={`fade-layer ${className}`} style={{ opacity: 0, visibility: "hidden" }}>
      {children}
    </div>
  );
}
