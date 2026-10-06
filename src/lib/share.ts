/** System share sheet with a clipboard fallback. */
export async function shareText(text: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      /* user cancelled or share failed — fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* best effort */
  }
  return "copied";
}
