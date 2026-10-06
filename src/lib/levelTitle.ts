/** Fun level titles, one per 5 levels. */
const TITLES = [
  "Новичок",
  "Искатель",
  "Практик",
  "Дисциплинированный",
  "Мастер привычек",
  "Стратег",
  "Легенда",
] as const;

export function levelTitle(level: number): (typeof TITLES)[number] {
  const idx = Math.min(TITLES.length - 1, Math.floor((Math.max(1, level) - 1) / 5));
  return TITLES[idx];
}
