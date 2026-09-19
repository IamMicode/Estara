import { Link, useLocation } from "react-router-dom";
import { Modal } from "./ui";

/**
 * Shown when an unauthenticated visitor tries to favourite or inquire.
 * Never fails silently — the spec is explicit about this.
 */
export function LoginPrompt({
  onClose,
  action = "save properties",
}: {
  onClose: () => void;
  action?: string;
}) {
  const loc = useLocation();
  const from = loc.pathname + loc.search;

  return (
    <Modal title="Create a free account" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 20, lineHeight: 1.6 }}>
        You need an Estara account to {action}. It takes less than a minute, and you'll be able to
        track everything you're interested in.
      </p>
      <div className="stack">
        <Link to="/register/customer" state={{ from }} className="btn btn--primary btn--block">
          Create an account
        </Link>
        <Link to="/login" state={{ from }} className="btn btn--ghost btn--block">
          I already have an account
        </Link>
      </div>
      <div className="modal__actions">
        <button className="btn btn--quiet" onClick={onClose}>
          Not now
        </button>
      </div>
    </Modal>
  );
}
