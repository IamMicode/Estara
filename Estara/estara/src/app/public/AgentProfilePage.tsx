import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicAgent, listAgentPublicProperties } from "../../lib/api";
import { friendlyError, isSupabaseConfigured } from "../../lib/supabase";
import type { PropertyWithRelations, PublicAgent } from "../../lib/database.types";
import { PropertyCard } from "../components/PropertyCard";
import { Alert, Avatar, BackLink, EmptyState, ErrorState, LoadingBlock, VerificationBadge } from "../components/ui";

export function AgentProfilePage() {
  const { id = "" } = useParams();
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [items, setItems] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [a, p] = await Promise.all([getPublicAgent(id), listAgentPublicProperties(id)]);
      setAgent(a);
      setItems(p);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSupabaseConfigured)
    return (
      <div className="page">
        <Alert kind="warn">
          Agent profiles load from the database. Connect Supabase to view this page.
        </Alert>
      </div>
    );
  if (loading) return <LoadingBlock label="Loading agent…" />;
  if (error)
    return (
      <div className="page">
        <ErrorState body={error} onRetry={load} />
      </div>
    );
  if (!agent)
    return (
      <div className="page">
        <EmptyState
          title="Agent not found"
          body="This agent profile isn't available."
          action={
            <Link to="/explore" className="btn btn--primary">
              Back to Explore
            </Link>
          }
        />
      </div>
    );

  return (
    <div className="page">
      <BackLink to="/explore">Back to Explore</BackLink>

      <div className="card card--pad" style={{ marginBottom: 28 }}>
        <div className="row row--wrap" style={{ gap: 18, alignItems: "flex-start" }}>
          <Avatar name={agent.display_name ?? agent.agency_name} url={agent.avatar_url} large />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row row--wrap" style={{ gap: 10 }}>
              <h1 style={{ fontSize: 26, margin: 0 }}>{agent.display_name || agent.agency_name}</h1>
              <VerificationBadge status={agent.verification_status} />
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              {agent.agency_name}
              {agent.years_experience ? ` · ${agent.years_experience} years experience` : ""}
            </p>
            {agent.bio && <p className="prose" style={{ marginTop: 14 }}>{agent.bio}</p>}

            {agent.specialties?.length > 0 && (
              <div className="row row--wrap" style={{ gap: 8, marginTop: 14 }}>
                {agent.specialties.map((s) => (
                  <span key={s} className="badge">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {agent.service_locations?.length > 0 && (
              <p className="muted" style={{ marginTop: 12 }}>
                Serving: {agent.service_locations.join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 16 }}>
        {items.length} active {items.length === 1 ? "listing" : "listings"}
      </h2>

      {items.length === 0 ? (
        <EmptyState title="No active listings" body="This agent doesn't have published properties right now." />
      ) : (
        <div className="property-grid">
          {items.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
