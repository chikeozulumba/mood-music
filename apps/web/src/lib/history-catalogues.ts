import type { HistoryEntry } from "./api-client";

export interface HistoryCatalogue {
  id: string;
  label: string;
  entries: HistoryEntry[]; // newest first
  latestDate: number;
}

// Groups history entries into "catalogues" of similar searches by shared
// Claude-derived search-query terms (not the raw mood text, which is
// free-form and rarely matches word-for-word). Entries are processed
// newest-first (the order /api/history already returns); an entry joins the
// first existing catalogue it shares any search-query term with, growing
// that catalogue's term set, or starts a new one. Catalogues are then
// sorted by their most recent entry's date.
export function groupHistoryIntoCatalogues(
  entries: HistoryEntry[]
): HistoryCatalogue[] {
  const buckets: { terms: Set<string>; entries: HistoryEntry[] }[] = [];

  for (const entry of entries) {
    const entryTerms = new Set(
      entry.searchQueries.map((q) => q.trim().toLowerCase())
    );

    const match = buckets.find((bucket) =>
      [...entryTerms].some((term) => bucket.terms.has(term))
    );

    if (match) {
      match.entries.push(entry);
      entryTerms.forEach((term) => match.terms.add(term));
    } else {
      buckets.push({ terms: entryTerms, entries: [entry] });
    }
  }

  return buckets
    .map((bucket) => ({
      id: bucket.entries[0].id,
      label: mostFrequentTerm(bucket.entries) ?? bucket.entries[0].moodText,
      entries: bucket.entries,
      latestDate: bucket.entries[0].createdAt,
    }))
    .sort((a, b) => b.latestDate - a.latestDate);
}

function mostFrequentTerm(entries: HistoryEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const query of entry.searchQueries) {
      const term = query.trim().toLowerCase();
      if (!term) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [term, count] of counts) {
    if (count > bestCount) {
      best = term;
      bestCount = count;
    }
  }
  return best;
}
