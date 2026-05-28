import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";

// Recharts needs *concrete* color strings (it writes them as SVG fill/stroke
// attributes). A CSS `var(--x)` reference works on screen but does NOT survive
// the SVG→canvas serialization used for PNG export — the detached image has no
// access to the document's custom properties. So we resolve the design tokens
// to their computed values here and hand Recharts the real colors.
export type ChartColors = {
  primary: string; // single-series bars + the timeline line (brand accent)
  grid: string; // CartesianGrid stroke (border token)
  axis: string; // axis ticks/lines + secondary text (muted-foreground)
  surface: string; // chart/PNG backdrop (background token)
  text: string; // labels in the exported PNG (foreground token)
  // Status carries meaning, so these are intentionally NOT tokens — they mirror
  // the emerald/amber of the list's status pills, picked per theme for contrast.
  analyzed: string;
  notAnalyzed: string;
};

function read(isDark: boolean): ChartColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    primary: v("--primary"),
    grid: v("--border"),
    axis: v("--muted-foreground"),
    surface: v("--background"),
    text: v("--foreground"),
    // emerald-600 / amber-600 on light; emerald-400 / amber-400 on dark.
    analyzed: isDark ? "#34d399" : "#059669",
    notAnalyzed: isDark ? "#fbbf24" : "#d97706",
  };
}

// Theme-reactive token reader. Re-reads whenever the theme flips (the `.dark`
// class is toggled inside the same ThemeProvider, so keying on `theme` is
// enough — no MutationObserver needed).
export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(() => read(theme === "dark"));
  useEffect(() => {
    setColors(read(theme === "dark"));
  }, [theme]);
  return colors;
}
