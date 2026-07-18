import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchCbsTopLevel, fetchCbsLeafSeries, fetchCbsSeries } from "../server-lib/cbsClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, "..", "data", "cbs-indicator-map.json");

interface IndicatorMapping {
  key: string;
  labelEn: string;
  labelHe: string;
  eurostatDatasetCode: string;
  euFilterOverrides?: Record<string, string>;
  cbsApiType: "series" | "index";
  cbsCode: string;
  cbsValueKind?: "level" | "yoy";
  verifiedAt: string;
  notes?: string;
}

interface Target {
  key: string;
  eurostatDatasetCode: string;
  labelEn: string;
  labelHe: string;
  keywords: string[];
  excludeKeywords?: string[];
}

// Concepts we try to pair with a real CBS series. Eurostat dataset codes
// are ones already confirmed live (see README/CLAUDE.md); keywords are
// matched case-insensitively against CBS's own English leaf-series titles
// surfaced by a catalog crawl (see the "unreliable catalog" caveat in
// CLAUDE.md — a keyword hit is only a candidate until series/data/list
// confirms it actually returns data).
const TARGETS: Target[] = [
  { key: "cpi_general", eurostatDatasetCode: "prc_hicp_aind", labelEn: "Consumer Price Index", labelHe: "מדד המחירים לצרכן", keywords: ["consumer price index", "general index", "price index"] },
  { key: "unemployment_rate", eurostatDatasetCode: "une_rt_a", labelEn: "Unemployment rate", labelHe: "שיעור אבטלה", keywords: ["unemployment rate", "unemployed persons", "unemployment"] },
  { key: "gdp", eurostatDatasetCode: "nama_10_pc", labelEn: "Gross Domestic Product", labelHe: "תוצר מקומי גולמי", keywords: ["gross domestic product", "gdp at market", "gdp per capita"] },
  { key: "life_expectancy", eurostatDatasetCode: "demo_mlexpec", labelEn: "Life expectancy", labelHe: "תוחלת חיים", keywords: ["life expectancy", "expectancy at birth"] },
  {
    key: "population_total",
    eurostatDatasetCode: "demo_pjan",
    labelEn: "Total population",
    labelHe: "אוכלוסייה",
    keywords: ["total population"],
    excludeKeywords: ["male", "female", "jewish", "arab", "muslim", "christian", "druze"],
  },
  { key: "average_wage", eurostatDatasetCode: "earn_nt_net", labelEn: "Average monthly wage", labelHe: "שכר חודשי ממוצע", keywords: ["average wage", "average salary", "gross wage", "average gross"] },
  { key: "birth_rate", eurostatDatasetCode: "demo_gind", labelEn: "Live births", labelHe: "לידות חי", keywords: ["live births", "birth rate"] },
  { key: "exports_total", eurostatDatasetCode: "ext_lt_intertrd", labelEn: "Total exports", labelHe: "יצוא כולל", keywords: ["total exports", "exports, total"] },
  { key: "imports_total", eurostatDatasetCode: "ext_lt_intertrd", labelEn: "Total imports", labelHe: "יבוא כולל", keywords: ["total imports", "imports, total"] },
  { key: "housing_price_index", eurostatDatasetCode: "prc_hpi_a", labelEn: "House price index", labelHe: "מדד מחירי דירות", keywords: ["dwelling price", "house price", "housing price"] },
];

function parseArgs(argv: string[]) {
  const commit = argv.includes("--commit");
  const pagesArg = argv.find((a) => a.startsWith("--pages="));
  const pages = pagesArg ? Number(pagesArg.slice("--pages=".length)) : 1;
  return { commit, pages };
}

async function main() {
  const { commit, pages } = parseArgs(process.argv.slice(2));

  console.log("Fetching CBS top-level categories...");
  const categories = await fetchCbsTopLevel("en");
  console.log(`  ${categories.length} categories found.\n`);

  const candidates = new Map<string, { seriesId: string; title: string; categoryTitle: string }[]>();
  for (const target of TARGETS) candidates.set(target.key, []);

  for (const cat of categories) {
    for (let page = 1; page <= pages; page++) {
      let leaves;
      try {
        leaves = await fetchCbsLeafSeries(cat.id, page, 200, "en");
      } catch {
        break;
      }
      if (leaves.length === 0) break;

      for (const leaf of leaves) {
        const titleLower = leaf.title.toLowerCase();
        for (const target of TARGETS) {
          const matches = target.keywords.some((kw) => titleLower.includes(kw));
          const excluded = target.excludeKeywords?.some((kw) => titleLower.includes(kw)) ?? false;
          if (matches && !excluded) {
            candidates.get(target.key)!.push({ seriesId: leaf.seriesId, title: leaf.title, categoryTitle: cat.title });
          }
        }
      }
      if (leaves.length < 200) break;
    }
  }

  const existing: IndicatorMapping[] = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, "utf-8")) : [];
  const confirmed: IndicatorMapping[] = [];

  for (const target of TARGETS) {
    const found = candidates.get(target.key)!;
    console.log(`\n${target.key} (${target.labelEn}): ${found.length} keyword-matched candidate(s)`);
    const uniqueSeriesIds = Array.from(new Set(found.map((f) => f.seriesId))).slice(0, 12);
    for (const seriesId of uniqueSeriesIds) {
      const example = found.find((f) => f.seriesId === seriesId)!;
      process.stdout.write(`  #${seriesId} "${example.title}" (in ${example.categoryTitle}) — verifying live... `);
      try {
        const result = await fetchCbsSeries(seriesId, "en");
        if (result.series.length === 0) {
          console.log("no observations, skipping");
          continue;
        }
        // CBS's catalog leaf title is known to be unreliable (a leaf
        // labeled "Exports, Total" can resolve to an unrelated import
        // sub-series when fetched — see CLAUDE.md). Require the ACTUAL
        // fetched title (series/data/list's own name_id) to also match
        // one of the target keywords before accepting the pairing —
        // catalog-title agreement alone is not enough evidence.
        const fetchedTitleLower = (result.title ?? "").toLowerCase();
        const fetchedTitleCorroborates = target.keywords.some((kw) => fetchedTitleLower.includes(kw));
        if (!fetchedTitleCorroborates) {
          console.log(`REJECTED — fetched title "${result.title}" does not corroborate catalog label`);
          continue;
        }
        console.log(`OK (${result.series.length} points, updated ${result.updated}, title "${result.title}")`);
        confirmed.push({
          key: target.key,
          eurostatDatasetCode: target.eurostatDatasetCode,
          cbsApiType: "series",
          cbsCode: seriesId,
          labelEn: target.labelEn,
          labelHe: target.labelHe,
          verifiedAt: new Date().toISOString().slice(0, 10),
          notes: `Matched via discover-cbs.ts; catalog label "${example.title}", CBS's own fetched title "${result.title}" (both corroborate)`,
        });
        break; // first double-confirmed candidate per target is enough for MVP
      } catch (err) {
        console.log(`FAIL (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  console.log(`\nConfirmed ${confirmed.length} of ${TARGETS.length} target indicators.`);
  for (const c of confirmed) {
    console.log(`  ${c.key} -> CBS #${c.cbsCode} / Eurostat ${c.eurostatDatasetCode}`);
  }

  if (commit) {
    const merged = [...existing.filter((e) => !confirmed.some((c) => c.key === e.key)), ...confirmed];
    writeFileSync(MAP_PATH, JSON.stringify(merged, null, 2) + "\n");
    console.log(`\nWrote ${merged.length} entries to ${MAP_PATH}`);
  } else {
    console.log("\n(dry run — pass --commit to write data/cbs-indicator-map.json)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
