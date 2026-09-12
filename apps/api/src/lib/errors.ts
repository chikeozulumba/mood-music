// Upstream APIs (Claude, Spotify) return their errors as JSON blobs with
// slightly different shapes. This pulls out just the human-readable message
// so we never dump raw JSON into an error the user sees.
export function extractApiErrorMessage(rawText: string): string {
  try {
    const parsed = JSON.parse(rawText) as any;
    if (typeof parsed?.error_description === "string") return parsed.error_description;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // Not JSON — fall through and use the raw text as-is.
  }
  return rawText;
}
