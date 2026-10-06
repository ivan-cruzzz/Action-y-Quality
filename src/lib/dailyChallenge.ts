import { dayOfYear } from "@/lib/date";

/** Deterministic daily micro-challenge: everyone gets the same one per day. */
export const CHALLENGE_CODES = [
  "water8",
  "walk15",
  "stretch5",
  "deepbreath",
  "nofeed",
  "tidy10",
  "earlybed",
  "grateful3",
  "read10",
  "nosugar",
  "plan_tomorrow",
  "coldshower",
  "inbox0",
  "call_friend",
  "posture",
  "sunlight",
  "steps5k",
  "journal5",
  "no_alcohol",
  "meditate10",
] as const;

export type ChallengeCode = (typeof CHALLENGE_CODES)[number];

export function challengeOfDay(d: Date = new Date()): ChallengeCode {
  return CHALLENGE_CODES[(dayOfYear(d) - 1) % CHALLENGE_CODES.length];
}

export function challengeTitleKey(code: string): string {
  return `challenge.${code}`;
}
