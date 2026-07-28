/**
 * Join Duel screen (legacy) — superseded by JoinLandingScreen in S1.
 * Kept compiling so the route in App.tsx does not break before S1 lands.
 */

import { useNavigate } from "react-router-dom";

export function JoinDuelScreen() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <p>Redirecting…</p>
      <button className="btn" onClick={() => navigate("/")}>
        Home
      </button>
    </div>
  );
}
