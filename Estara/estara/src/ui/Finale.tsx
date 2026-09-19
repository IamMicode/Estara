import { useRef, useState } from "react";
import { clamp, lerp, smootherstep, smoothstep } from "../journey/journey";
import { useJourneyTick } from "./useJourney";

/**
 * SCENE 06 — YOUR NEXT MOVE.
 *
 * The climax. The platform simplifies away, the world darkens and settles, and
 * ESTARA resolves at full scale with two large role choices.
 *
 * Choreography (journey space):
 *   5.30  vignette closes in, world dims
 *   5.38  wordmark letter-spacing collapses from wide to settled + scales up
 *   5.52  headline rises
 *   5.62  role cards sweep in, staggered, with a light-rake highlight
 *   5.82  sign-in / footer
 */

const ROUTES = {
  customer: "/customer/register",
  agent: "/agent/register",
  login: "/login",
};

function navigate(route: string) {
  // Full navigation: leaving the cinematic route also unmounts the WebGL system.
  window.location.assign(route);
}

export function Finale() {
  const root = useRef<HTMLDivElement>(null);
  const vignette = useRef<HTMLDivElement>(null);
  const wordmark = useRef<HTMLHeadingElement>(null);
  const lead = useRef<HTMLParagraphElement>(null);
  const sub = useRef<HTMLParagraphElement>(null);
  const cardA = useRef<HTMLButtonElement>(null);
  const cardB = useRef<HTMLButtonElement>(null);
  const foot = useRef<HTMLParagraphElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useJourneyTick((p) => {
    const show = smootherstep(5.24, 5.46, p);

    if (root.current) {
      root.current.style.opacity = String(clamp(show));
      root.current.style.visibility = show < 0.004 ? "hidden" : "visible";
      root.current.style.pointerEvents = show > 0.75 ? "auto" : "none";
    }

    // cinematic vignette + dim closes over the world
    if (vignette.current) {
      const v = smootherstep(5.18, 5.62, p);
      vignette.current.style.opacity = String(clamp(v));
    }

    // wordmark: wide tracking collapsing inward as it scales up
    if (wordmark.current) {
      const t = smootherstep(5.34, 5.72, p);
      wordmark.current.style.opacity = String(clamp(smootherstep(5.3, 5.5, p)));
      const tracking = lerp(1.1, 0.36, t);
      wordmark.current.style.letterSpacing = `${tracking.toFixed(3)}em`;
      wordmark.current.style.paddingLeft = `${tracking.toFixed(3)}em`;
      wordmark.current.style.transform = `translate3d(0, ${lerp(20, 0, t).toFixed(
        2
      )}px, 0) scale(${lerp(0.94, 1, t).toFixed(4)})`;
      wordmark.current.style.filter = `blur(${lerp(9, 0, t).toFixed(2)}px)`;
    }

    const rise = (el: HTMLElement | null, a: number, b: number, dist = 22) => {
      if (!el) return;
      const t = smootherstep(a, b, p);
      el.style.opacity = String(clamp(t));
      el.style.transform = `translate3d(0, ${lerp(dist, 0, t).toFixed(2)}px, 0)`;
    };

    rise(lead.current, 5.48, 5.7);
    rise(sub.current, 5.56, 5.76, 16);
    rise(foot.current, 5.82, 5.98, 14);

    // role cards: staggered sweep with a travelling light rake
    const card = (el: HTMLButtonElement | null, a: number, b: number, dir: number) => {
      if (!el) return;
      const t = smootherstep(a, b, p);
      el.style.opacity = String(clamp(t));
      el.style.transform = `translate3d(${lerp(dir * 40, 0, t).toFixed(2)}px, ${lerp(
        30,
        0,
        t
      ).toFixed(2)}px, 0) scale(${lerp(0.965, 1, t).toFixed(4)})`;
      el.style.setProperty("--rake", String(clamp(smoothstep(a + 0.04, b + 0.16, p))));
    };
    card(cardA.current, 5.6, 5.84, -1);
    card(cardB.current, 5.66, 5.9, 1);
  });

  const choose = (key: keyof typeof ROUTES) => () => {
    setChosen(key);
    navigate(ROUTES[key]);
  };

  return (
    <>
      <div className="finale-vignette" ref={vignette} aria-hidden="true" />

      <div className="finale-root" ref={root} style={{ opacity: 0, visibility: "hidden" }}>
        <div className="finale">
          <h1 className="finale__wordmark" ref={wordmark}>
            ESTARA
          </h1>

          <p className="finale__lead" ref={lead}>
            Where will your next chapter take you?
          </p>
          <p className="finale__sub" ref={sub}>
            Start with Estara.
          </p>

          <div className="roles">
            <button
              type="button"
              className={`role ${chosen === "customer" ? "role--chosen" : ""}`}
              ref={cardA}
              onClick={choose("customer")}
              aria-label="Continue as a customer — I'm looking for a home"
            >
              <span className="role__eyebrow">I'M LOOKING FOR A HOME</span>
              <span className="role__title">Explore Properties</span>
              <span className="role__text">
                Discover homes, apartments, land and spaces worth considering.
              </span>
              <span className="role__cta">
                Continue as a Customer
                <svg viewBox="0 0 24 24" aria-hidden="true" className="role__arrow">
                  <path
                    d="M4 12h15m0 0-6-6m6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>

            <button
              type="button"
              className={`role role--agent ${chosen === "agent" ? "role--chosen" : ""}`}
              ref={cardB}
              onClick={choose("agent")}
              aria-label="Continue as an agent — I'm listing a property"
            >
              <span className="role__eyebrow">I'M LISTING A PROPERTY</span>
              <span className="role__title">List a Property</span>
              <span className="role__text">
                Put your properties in front of people looking for their next place.
              </span>
              <span className="role__cta">
                Continue as an Agent
                <svg viewBox="0 0 24 24" aria-hidden="true" className="role__arrow">
                  <path
                    d="M4 12h15m0 0-6-6m6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>

          <p className="finale__signin" ref={foot}>
            Already have an account?{" "}
            <button className="linkbtn" type="button" onClick={choose("login")}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
