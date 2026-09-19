import { useRef } from "react";
import { clamp, lerp, smootherstep, smoothstep } from "../journey/journey";
import { useJourneyTick } from "./useJourney";

/**
 * A layer that *emerges* from the cinematic world instead of appearing on top
 * of it.
 *
 * Three coupled properties drive the illusion, all keyed to journey progress:
 *  - `--emerge`  0 → 1 : opacity of the content itself
 *  - `--solid`   0 → 1 : backdrop blur, surface opacity, border and shadow
 *  - transform         : a slight scale-up + parallax rise, as if the
 *                        interface is condensing out of the depth of field
 *
 * Early on the panel is almost pure transparency — you read the landscape
 * through it. As the camera pulls back and the world desaturates, the surface
 * thickens into real, opaque product UI.
 */
export function EmergentLayer({
  /** [start emerging, fully emerged, start solidifying, fully solid] */
  emerge,
  /** optional fade-out window [start, end] */
  exit,
  children,
  className = "",
}: {
  emerge: [number, number, number, number];
  exit?: [number, number];
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useJourneyTick((p) => {
    const el = ref.current;
    if (!el) return;
    const [a, b, c, d] = emerge;

    const appear = smootherstep(a, b, p);
    const solid = smootherstep(c, d, p);
    const out = exit ? smoothstep(exit[0], exit[1], p) : 0;

    const opacity = clamp(appear * (1 - out));
    el.style.opacity = String(opacity);
    el.style.visibility = opacity < 0.004 ? "hidden" : "visible";
    el.style.pointerEvents = solid > 0.6 && out < 0.3 ? "auto" : "none";

    // condense out of depth: starts slightly larger and lifted, settles home
    const scale = lerp(1.055, 1, appear) * lerp(1, 0.985, out);
    const y = lerp(34, 0, appear) + out * -18;
    el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

    // the surface itself thickens
    el.style.setProperty("--emerge", opacity.toFixed(3));
    el.style.setProperty("--solid", clamp(solid * (1 - out)).toFixed(3));
  });

  return (
    <div
      ref={ref}
      className={`emergent ${className}`}
      style={{ opacity: 0, visibility: "hidden" }}
    >
      {children}
    </div>
  );
}

/**
 * Staggered child reveal — each item emerges a beat after the last, so the
 * interface assembles itself rather than switching on.
 */
export function EmergentItem({
  range,
  index = 0,
  stagger = 0.055,
  children,
  className = "",
}: {
  range: [number, number];
  index?: number;
  stagger?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useJourneyTick((p) => {
    const el = ref.current;
    if (!el) return;
    const a = range[0] + index * stagger;
    const b = range[1] + index * stagger;
    const t = smootherstep(a, b, p);
    el.style.opacity = String(clamp(t));
    el.style.transform = `translate3d(0, ${lerp(26, 0, t).toFixed(2)}px, 0) scale(${lerp(
      0.97,
      1,
      t
    ).toFixed(4)})`;
    el.style.filter = `blur(${lerp(7, 0, t).toFixed(2)}px)`;
  });
  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
