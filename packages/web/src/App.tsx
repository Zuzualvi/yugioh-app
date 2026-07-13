import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DeckBuilderScreen } from "./screens/DeckBuilderScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MyDecksScreen } from "./screens/MyDecksScreen";
import "./styles/global.css";
import "./styles/builder.css";

/** Route guard: redirects to login when not authenticated. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

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

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
