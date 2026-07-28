import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DeckBuilderScreen } from "./screens/DeckBuilderScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MyDecksScreen } from "./screens/MyDecksScreen";
import { CreateDuelScreen } from "./screens/CreateDuelScreen";
import { JoinDuelScreen } from "./screens/JoinDuelScreen";
import { DuelScreen } from "./screens/DuelScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { DocsLandingScreen } from "./screens/learn/DocsLandingScreen";
import { DocArticleScreen } from "./screens/learn/DocArticleScreen";
import "./styles/global.css";
import "./styles/builder.css";

/** Route guard: redirects to login when not authenticated. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Capture the intended path so login can resume here (INVITE-01: a
      // logged-out user opening /duel/join/:token lands back on that link).
      navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
    }
  }, [user, loading, navigate, location]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="loading-spinner" aria-label="Loading…" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

/** Route guard: redirects authenticated users away from login. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginScreen />
          </RedirectIfAuthed>
        }
      />

      {/* Protected */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/decks"
        element={
          <RequireAuth>
            <MyDecksScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/builder"
        element={
          <RequireAuth>
            <DeckBuilderScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/builder/:id"
        element={
          <RequireAuth>
            <DeckBuilderScreen />
          </RequireAuth>
        }
      />

      {/* Duel routes */}
      <Route
        path="/duel/new"
        element={
          <RequireAuth>
            <CreateDuelScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/duel/join/:joinToken"
        element={
          <RequireAuth>
            <JoinDuelScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/duel/:roomId/room"
        element={
          <RequireAuth>
            <RoomScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/duel/:duelId"
        element={
          <RequireAuth>
            <DuelScreen />
          </RequireAuth>
        }
      />

      {/* Docs — /learn and /rules alias (B4-REQ-1) */}
      <Route
        path="/learn"
        element={
          <RequireAuth>
            <DocsLandingScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/learn/how-to/:slug"
        element={
          <RequireAuth>
            <DocArticleScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/learn/rules/:slug"
        element={
          <RequireAuth>
            <DocArticleScreen />
          </RequireAuth>
        }
      />
      {/* /rules → alias for /learn/rules (IA §2.1) */}
      <Route path="/rules" element={<Navigate to="/learn" replace />} />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
