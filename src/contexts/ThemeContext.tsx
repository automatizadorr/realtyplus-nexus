import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, ThemeConfig } from "@/lib/themePresets";

const STORAGE_KEY = "rp_theme_config";

interface ThemeContextType {
  theme: ThemeConfig;
  applyTheme: (cfg: ThemeConfig) => void;
  saveTheme: (cfg: ThemeConfig) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  applyTheme: () => {},
  saveTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function readStored(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

function applyToRoot(cfg: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty("--primary", cfg.primary);
  root.style.setProperty("--ring", cfg.primary);
  root.style.setProperty("--accent", cfg.accent);
  root.style.setProperty("--background", cfg.background);
  root.style.setProperty("--sidebar-background", cfg.sidebarBackground);
  root.style.setProperty("--sidebar-accent", cfg.sidebarAccent);
  root.style.setProperty("--sidebar-border", cfg.sidebarAccent);
  root.style.setProperty("--sidebar-ring", cfg.accent);
  root.style.setProperty("--sidebar-primary", cfg.accent);
  root.style.setProperty("--brand-blue", cfg.primary);
  root.style.setProperty("--brand-red", cfg.accent);
  root.style.setProperty("--radius", cfg.radius);
}

// Apply immediately on module load to avoid flash
if (typeof window !== "undefined") {
  applyToRoot(readStored());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig>(() => readStored());

  useEffect(() => {
    applyToRoot(theme);
  }, []);

  const applyTheme = (cfg: ThemeConfig) => {
    applyToRoot(cfg);
    setTheme(cfg);
  };

  const saveTheme = (cfg: ThemeConfig) => {
    applyToRoot(cfg);
    setTheme(cfg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, applyTheme, saveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
