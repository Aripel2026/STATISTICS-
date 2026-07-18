import { fetchCbsTopLevel, fetchCbsLeafSeries } from "./cbsClient.js";

export interface CbsIndexEntry {
  seriesId: string;
  title: string;
  topLevelId: string;
  topLevelTitle: string;
}

const PAGES_PER_CATEGORY = 1;
const CONCURRENCY = 8;
const INDEX_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedIndex: { builtAt: number; entries: CbsIndexEntry[] } | null = null;
let buildingPromise: Promise<CbsIndexEntry[]> | null = null;

async function crawlCategory(topLevelId: string, topLevelTitle: string): Promise<CbsIndexEntry[]> {
  const entries: CbsIndexEntry[] = [];
  for (let page = 1; page <= PAGES_PER_CATEGORY; page++) {
    let leaves;
    try {
      leaves = await fetchCbsLeafSeries(topLevelId, page, 200, "en");
    } catch {
      break;
    }
    if (leaves.length === 0) break;
    for (const leaf of leaves) {
      entries.push({ seriesId: leaf.seriesId, title: leaf.title, topLevelId, topLevelTitle });
    }
    if (leaves.length < 200) break;
  }
  return entries;
}

async function buildIndex(): Promise<CbsIndexEntry[]> {
  const categories = await fetchCbsTopLevel("en");
  const results: CbsIndexEntry[] = [];

  for (let i = 0; i < categories.length; i += CONCURRENCY) {
    const batch = categories.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((cat) => crawlCategory(cat.id, cat.title).catch(() => [] as CbsIndexEntry[])),
    );
    for (const r of batchResults) results.push(...r);
  }

  // De-duplicate by seriesId — the same leaf number can surface under
  // multiple dimension-combination rows within a category (see CLAUDE.md).
  const seen = new Set<string>();
  const deduped: CbsIndexEntry[] = [];
  for (const entry of results) {
    if (seen.has(entry.seriesId)) continue;
    seen.add(entry.seriesId);
    deduped.push(entry);
  }
  return deduped;
}

export async function getCbsIndex(): Promise<CbsIndexEntry[]> {
  if (cachedIndex && Date.now() - cachedIndex.builtAt < INDEX_CACHE_TTL_MS) {
    return cachedIndex.entries;
  }
  if (!buildingPromise) {
    buildingPromise = buildIndex()
      .then((entries) => {
        cachedIndex = { builtAt: Date.now(), entries };
        return entries;
      })
      .finally(() => {
        buildingPromise = null;
      });
  }
  return buildingPromise;
}

export function searchCbsIndex(entries: CbsIndexEntry[], query: string, limit = 30): CbsIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = entries.filter((e) => e.title.toLowerCase().includes(q) || e.seriesId === q);
  matches.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
  return matches.slice(0, limit);
}
