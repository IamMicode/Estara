import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PropertyStatus, VerificationStatus } from "../../lib/database.types";
import { STATUS_LABELS, VERIFICATION_LABELS } from "../../lib/database.types";

/* ------------------------------------------------------------- feedback ---- */

export function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`spinner ${dark ? "spinner--dark" : ""}`} aria-hidden="true" />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="center-load" role="status" aria-live="polite">
      <Spinner dark />
      <span>{label}</span>
    </div>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "error" | "success" | "info" | "warn";
  children: ReactNode;
}) {
  return (
    <div className={`alert alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="property-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pcard">
          <div className="skeleton" style={{ aspectRatio: "4 / 3", borderRadius: 0 }} />
          <div className="pcard__body">
            <div className="skeleton" style={{ height: 18, width: "45%" }} />
            <div className="skeleton" style={{ height: 14, width: "85%" }} />
            <div className="skeleton" style={{ height: 12, width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- badges ---- */

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      {status === "verified" && "✓ "}
      {VERIFICATION_LABELS[status]}
    </span>
  );
}

/* ---------------------------------------------------------------- forms ---- */

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field-group">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- modal ----- */

export function Modal({
  title,
  onClose,
  children,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
    )?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const items = el.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        ref={ref}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- avatar ----- */

export function Avatar({
  name,
  url,
  large,
}: {
  name: string;
  url?: string | null;
  large?: boolean;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  if (url) {
    return <img className={`avatar ${large ? "avatar--lg" : ""}`} src={url} alt="" />;
  }
  return (
    <span className={`avatar ${large ? "avatar--lg" : ""}`} aria-hidden="true">
      {initials || "·"}
    </span>
  );
}

/* -------------------------------------------------------------- pager ------ */

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const nums: number[] = [];
  const push = (n: number) => n >= 1 && n <= pages && !nums.includes(n) && nums.push(n);
  push(1);
  for (let i = page - 1; i <= page + 1; i++) push(i);
  push(pages);
  nums.sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label="Pagination">
      <button
        className="pager__btn"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ←
      </button>
      {nums.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && nums[i - 1] !== n - 1 && <span className="muted">…</span>}
          <button
            className={`pager__btn ${n === page ? "is-active" : ""}`}
            onClick={() => onPage(n)}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        className="pager__btn"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  );
}

/* ---------------------------------------------------------------- icons ---- */

export const Icon = {
  heart: (filled = false) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM10 18.5a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  chevron: (dir: "left" | "right") => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d={dir === "left" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/* ------------------------------------------------------------ nav helper --- */

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link-quiet" style={{ display: "inline-block", marginBottom: 14 }}>
      ← {children}
    </Link>
  );
}
