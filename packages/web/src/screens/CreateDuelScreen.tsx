/**
 * Create Duel screen (legacy stub) — superseded by S1 rework.
 * Kept compiling so the route in App.tsx does not break before S1 lands.
 */

import { useNavigate } from "react-router-dom";

export function CreateDuelScreen() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <p>Create Duel — coming soon.</p>
      <button className="btn" onClick={() => navigate("/")}>
        Home
      </button>
    </div>
  );
}
