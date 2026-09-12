// Spotify's playlist search results don't include per-track duration data
// (that requires a separate call per playlist), so this is a labeled
// estimate rather than an exact figure.
const AVG_TRACK_SECONDS = 3.5 * 60;

export function estimateDuration(trackCount: number): string {
  const totalMinutes = Math.round((trackCount * AVG_TRACK_SECONDS) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `~${Math.max(minutes, 1)} min`;
  if (minutes === 0) return `~${hours} hr`;
  return `~${hours} hr ${minutes} min`;
}
