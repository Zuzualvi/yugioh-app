import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createInvite } from "../api/admin";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function HomeScreen() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function handleLogout() {
    await logout();
    addToast("Signed out", "info");
    navigate("/login", { replace: true });
  }

  async function handleCreateInvite() {
    setInviteLoading(true);
    try {
      const { inviteCode, expiresAt } = await createInvite();
      const link = `${window.location.origin}/login?invite=${inviteCode}`;
      setInviteLink(link);
      setInviteExpiry(new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: "long" }));
    } catch {
      addToast("Failed to generate invite link", "error");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      addToast("Link copied!", "success");
    } catch {
      addToast("Copy failed — select and copy the link manually", "error");
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: "1.25rem",
              color: "var(--accent-light)",
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            ⟡
          </span>
          <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "0.04em" }}>
            EDISON DUEL
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{ color: "var(--text-1)", fontSize: "0.9375rem" }}
            aria-label={`Signed in as ${user?.displayName}`}
          >
            ● {user?.displayName}
          </span>
          <button
            className="btn btn-ghost"
            onClick={handleLogout}
            style={{ padding: "8px 12px", minHeight: 44 }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        {/* Your move queue — SEAM for Slice 3 (duel queue placeholder) */}
        {/* When the duel system is live, this section will render the
            in-progress duels awaiting this player's move. */}
        <div style={{ marginBottom: 40 }} aria-label="Your move queue (not yet available)">
          {/* Slice 3 seam: empty state — no queue to show yet */}
        </div>

        {/* Page title */}
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Home</h1>
        <p style={{ color: "var(--text-1)", marginBottom: 32 }}>
          Welcome back, {user?.displayName}. What do you want to do?
        </p>

        {/* Primary actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {/* Duel a friend — stub for this slice */}
          <ActionCard
            icon="⚔"
            title="Duel a friend"
            description="Challenge a group member to a real-time or async duel."
            comingSoon
            href="#"
          />

          {/* Build a deck — live */}
          <ActionCard
            icon="🂡"
            title="Build a deck"
            description="Search cards, build your Edison deck, save and export."
            href="/decks"
          />

          {/* Rules & rulings — stub */}
          <ActionCard
            icon="📖"
            title="Rules & rulings"
            description="Edison format rules, ban list, and card rulings reference."
            comingSoon
            href="#"
          />
        </div>

        {/* Admin: Invite a friend */}
        {user?.role === "admin" && (
          <div style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Admin</h2>
            {!inviteLink ? (
              <button
                className="btn"
                onClick={handleCreateInvite}
                disabled={inviteLoading}
                style={{ minHeight: 44, padding: "10px 20px" }}
              >
                {inviteLoading ? "Generating…" : "Invite a friend"}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 20,
                  background: "var(--bg-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  maxWidth: 560,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Invite link</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    readOnly
                    value={inviteLink}
                    aria-label="Invite link"
                    style={{
                      flex: 1,
                      background: "var(--bg-0, #0d0d0d)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "var(--text-0)",
                      fontSize: "0.875rem",
                      minHeight: 44,
                    }}
                  />
                  <button
                    className="btn"
                    onClick={handleCopyLink}
                    style={{ minHeight: 44, padding: "10px 16px", whiteSpace: "nowrap" }}
                  >
                    Copy link
                  </button>
                </div>
                {inviteExpiry && (
                  <p style={{ color: "var(--text-1)", fontSize: "0.875rem", margin: 0 }}>
                    Expires {inviteExpiry}
                  </p>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={handleCreateInvite}
                  disabled={inviteLoading}
                  style={{ minHeight: 44, padding: "8px 16px", alignSelf: "flex-start" }}
                >
                  {inviteLoading ? "Generating…" : "Generate new link"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Seam: "Waiting on opponent" list placeholder for Slice 3 */}
        {/* <WaitingOnOpponent /> */}
      </main>
    </div>
  );
}

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  href: string;
  comingSoon?: boolean;
}

function ActionCard({ icon, title, description, href, comingSoon }: ActionCardProps) {
  return (
    <Link
      to={href}
      onClick={comingSoon ? (e) => e.preventDefault() : undefined}
      aria-disabled={comingSoon}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 20,
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        cursor: comingSoon ? "default" : "pointer",
        opacity: comingSoon ? 0.65 : 1,
        transition: "border-color var(--duration-fast), background var(--duration-fast)",
        minHeight: 44,
      }}
      onMouseEnter={(e) => {
        if (!comingSoon) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      <span style={{ fontSize: "1.75rem", lineHeight: 1 }} aria-hidden="true">
        {icon}
      </span>
      <div>
        <div
          style={{
            fontWeight: 600,
            fontSize: "1.0625rem",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {title}
          {comingSoon && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                background: "var(--bg-3)",
                color: "var(--text-2)",
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Soon
            </span>
          )}
        </div>
        <p style={{ color: "var(--text-1)", fontSize: "0.9375rem", lineHeight: 1.4 }}>
          {description}
        </p>
      </div>
    </Link>
  );
}
