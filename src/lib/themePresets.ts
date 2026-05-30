export interface ThemeConfig {
  primary: string;
  accent: string;
  background: string;
  sidebarBackground: string;
  sidebarAccent: string;
  radius: string;
  themeName: string;
}

export const THEME_PRESETS: ThemeConfig[] = [
  {
    themeName: "Clásico Realtyplus",
    primary: "210 100% 20%",
    accent: "0 100% 40%",
    background: "210 20% 98%",
    sidebarBackground: "210 100% 20%",
    sidebarAccent: "210 80% 28%",
    radius: "0.5rem",
  },
  {
    themeName: "Ejecutivo Oscuro",
    primary: "210 100% 15%",
    accent: "0 100% 40%",
    background: "210 30% 8%",
    sidebarBackground: "210 100% 8%",
    sidebarAccent: "210 80% 15%",
    radius: "0.5rem",
  },
  {
    themeName: "Rojo Dominante",
    primary: "0 100% 35%",
    accent: "210 100% 25%",
    background: "0 0% 98%",
    sidebarBackground: "0 85% 28%",
    sidebarAccent: "0 70% 35%",
    radius: "0.5rem",
  },
  {
    themeName: "Oro Premium",
    primary: "210 100% 20%",
    accent: "43 85% 45%",
    background: "43 20% 97%",
    sidebarBackground: "210 100% 18%",
    sidebarAccent: "43 60% 30%",
    radius: "0.375rem",
  },
  {
    themeName: "Minimalista",
    primary: "210 60% 25%",
    accent: "0 80% 45%",
    background: "0 0% 100%",
    sidebarBackground: "210 15% 20%",
    sidebarAccent: "210 15% 28%",
    radius: "0.25rem",
  },
  {
    themeName: "Redondeado Moderno",
    primary: "210 100% 20%",
    accent: "0 100% 40%",
    background: "210 20% 98%",
    sidebarBackground: "210 100% 20%",
    sidebarAccent: "210 80% 28%",
    radius: "1rem",
  },
];

export const DEFAULT_THEME: ThemeConfig = THEME_PRESETS[0];

export const PRIMARY_SWATCHES = [
  "210 100% 15%",
  "210 100% 18%",
  "210 100% 20%",
  "210 100% 25%",
  "210 80% 28%",
  "210 60% 35%",
  "210 40% 45%",
  "210 20% 55%",
];

export const ACCENT_SWATCHES = [
  "0 100% 35%",
  "0 100% 40%",
  "0 80% 45%",
  "0 60% 50%",
  "10 90% 42%",
  "20 90% 42%",
  "43 85% 45%",
  "43 70% 38%",
];

export const RADIUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Cuadrado", value: "0.25rem" },
  { label: "Normal", value: "0.5rem" },
  { label: "Suavizado", value: "0.75rem" },
  { label: "Redondeado", value: "1rem" },
];
