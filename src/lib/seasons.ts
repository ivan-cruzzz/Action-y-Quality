export type SeasonKey = "pink" | "mint" | "lilac" | "sunset";

export const SEASONS: { key: SeasonKey; labelKey: string; accent: string }[] = [
  { key: "pink", labelKey: "extra.season.pink", accent: "#EC6FA0" },
  { key: "mint", labelKey: "extra.season.mint", accent: "#3BBFA3" },
  { key: "lilac", labelKey: "extra.season.lilac", accent: "#9B7BD8" },
  { key: "sunset", labelKey: "extra.season.sunset", accent: "#F97362" },
];

const KEY_STORAGE = "aq.season";

/** Premium: seasonal accent + gradient, applied as a class on <html>. */
export function applySeason(season: SeasonKey | null): void {
  const root = document.documentElement;
  for (const s of SEASONS) root.classList.remove(`season-${s.key}`);
  if (season && season !== "pink") {
    root.classList.add(`season-${season}`);
    try {
      localStorage.setItem(KEY_STORAGE, season);
    } catch {
      /* ignore */
    }
  } else {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
  }
}

export function storedSeason(): SeasonKey | null {
  try {
    return (localStorage.getItem(KEY_STORAGE) as SeasonKey | null) ?? null;
  } catch {
    return null;
  }
}
