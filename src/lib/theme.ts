export type ThemeSettingLite = "system" | "light" | "dark";

export function applyTheme(setting: ThemeSettingLite): void {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = setting === "dark" || (setting === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

/** hex → "r g b" channels for Tailwind's <alpha-value> pattern. */
function hexToChannels(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Applies a premium accent override to the CSS variables.
 * Sets both the solid color and the RGB channels so every
 * `accent/<alpha>` utility keeps working.
 */
export function applyAccent(accent: string | null): void {
  const root = document.documentElement;
  if (accent) {
    const channels = hexToChannels(accent);
    if (channels) {
      root.style.setProperty("--aq-accent-rgb", channels);
      root.style.setProperty("--aq-accent", `rgb(${channels})`);
      root.style.setProperty("--accent", `rgb(${channels})`);
      return;
    }
  }
  root.style.removeProperty("--aq-accent-rgb");
  root.style.removeProperty("--aq-accent");
  root.style.removeProperty("--accent");
}
