import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import IntakeList from "@/pages/IntakeList";
import IntakeCreate from "@/pages/IntakeCreate";
import IntakeDetail from "@/pages/IntakeDetail";
import Profile from "@/pages/Profile";

// Lazy-loaded so the Recharts/d3 bundle only loads when the dashboard is opened,
// keeping the list/detail/auth views light.
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// Redirects unauthenticated users to the login screen.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

// Keeps authenticated users away from the auth screens.
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <IntakeList />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Suspense
              fallback={
                <div className="flex min-h-svh items-center justify-center text-muted-foreground">
                  Loading…
                </div>
              }
            >
              <Dashboard />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/intakes/new"
        element={
          <RequireAuth>
            <IntakeCreate />
          </RequireAuth>
        }
      />
      <Route
        path="/intakes/:id"
        element={
          <RequireAuth>
            <IntakeDetail />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
