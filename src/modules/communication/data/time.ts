// Timestamp policy for the Communication module.
//
// STORAGE: every timestamp is epoch milliseconds (UTC). Never a local string.
// DISPLAY: Skild Auto operates in America/Denver; formatting is explicit and
// always carries the zone so a rendered time is never ambiguous.

export const SKILD_TIME_ZONE = "America/Denver";

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: SKILD_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const timeOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: SKILD_TIME_ZONE,
  timeStyle: "short",
});

/** "Sep 1, 2026, 9:14 PM" in America/Denver. */
export function formatDenver(at: number | undefined): string {
  if (at === undefined) return "—";
  return dateTime.format(new Date(at));
}

/** Time-of-day only, America/Denver. */
export function formatDenverTime(at: number | undefined): string {
  if (at === undefined) return "—";
  return timeOnly.format(new Date(at));
}

/** Compact relative age, e.g. "3d", "5h", "just now". */
export function formatAge(at: number | undefined, now = Date.now()): string {
  if (at === undefined) return "—";
  const ms = Math.max(0, now - at);
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
