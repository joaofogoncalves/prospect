import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "intake_theme";

// Storage helpers guarded so they no-op where Storage is unavailable or throws
// (jsdom in tests, Safari private mode, etc.).
function readStored(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore — persistence is best-effort.
  }
}

// Read the persisted theme, falling back to the OS preference.
function getInitialTheme(): Theme {
  const stored = readStored();
  if (stored) return stored;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply the `dark` class to <html> and persist the choice.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeStored(theme);
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
