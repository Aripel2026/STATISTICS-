import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchEurostatDataset } from "../server-lib/eurostatClient.js";
import { fetchCbsSeries, fetchCbsPriceIndex } from "../server-lib/cbsClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, "..", "data", "cbs-indicator-map.json");
const REPORT_PATH = path.join(__dirname, "..", "verify-report.json");

// Datasets known to work as of the last live verification pass — always
// checked even before a curated CBS mapping exists for them, so the
// dynamic Eurostat catalog has a standing sanity check independent of CBS
// discovery progress.
const BASELINE_EUROSTAT_CODES = ["une_rt_a", "prc_hicp_aind", "demo_mlexpec", "nama_10_pc"];

interface IndicatorMapping {
  key: string;
  eurostatDatasetCode: string;
  euFilterOverrides?: Record<string, string>;
  cbsApiType: "series" | "index";
  cbsCode: string;
  cbsValueKind?: "level" | "yoy";
  labelEn: string;
  labelHe: string;
  verifiedAt: string;
  notes?: string;
}

interface EurostatCheckResult {
  code: string;
  ok: boolean;
  updated: string | null;
  yearRange: [number, number] | null;
  hasIsrael: boolean;
  hasEuAggregate: boolean;
  euAggregateCode: string | null;
  error?: string;
}

interface CbsCheckResult {
  code: string;
  ok: boolean;
  updated: string | null;
  yearRange: [number, number] | null;
  error?: string;
}

function parseArgs(argv: string[]) {
  const datasets: string[] = [];
  let discover = false;
  for (const arg of argv) {
    if (arg === "--discover") discover = true;
    else if (arg.startsWith("--dataset=")) datasets.push(arg.slice("--dataset=".length));
  }
  return { datasets, discover };
}

function yearRangeOf(series: Record<string, { year: number; value: number | null }[]>): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const points of Object.values(series)) {
    for (const p of points) {
      if (p.year < min) min = p.year;
      if (p.year > max) max = p.year;
    }
  }
  if (min === Infinity) return null;
  return [min, max];
}

async function checkEurostat(code: string, overrides?: Record<string, string>): Promise<EurostatCheckResult> {
  try {
    const result = await fetchEurostatDataset(code, overrides);
    return {
      code,
      ok: true,
      updated: result.updated,
      yearRange: yearRangeOf(result.series),
      hasIsrael: result.hasIsrael,
      hasEuAggregate: result.hasEuAggregate,
      euAggregateCode: result.euAggregateCode,
    };
  } catch (err) {
    return {
      code,
      ok: false,
      updated: null,
      yearRange: null,
      hasIsrael: false,
      hasEuAggregate: false,
      euAggregateCode: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkCbs(mapping: IndicatorMapping): Promise<CbsCheckResult> {
  try {
    const result =
      mapping.cbsApiType === "index"
        ? await fetchCbsPriceIndex(mapping.cbsCode, mapping.cbsValueKind ?? "yoy")
        : await fetchCbsSeries(mapping.cbsCode);
    const years = result.series.map((p) => p.year);
    const yearRange: [number, number] | null = years.length
      ? [Math.min(...years), Math.max(...years)]
      : null;
    return { code: mapping.cbsCode, ok: true, updated: result.updated, yearRange };
  } catch (err) {
    return {
      code: mapping.cbsCode,
      ok: false,
      updated: null,
      yearRange: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function padCell(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

async function main() {
  const { datasets: cliDatasets } = parseArgs(process.argv.slice(2));

  const mappings: IndicatorMapping[] = existsSync(MAP_PATH)
    ? JSON.parse(readFileSync(MAP_PATH, "utf-8"))
    : [];

  const eurostatCodes = Array.from(
    new Set([...BASELINE_EUROSTAT_CODES, ...mappings.map((m) => m.eurostatDatasetCode), ...cliDatasets]),
  );

  console.log(`Checking ${eurostatCodes.length} Eurostat dataset(s) live...\n`);
  const eurostatResults: EurostatCheckResult[] = [];
  for (const code of eurostatCodes) {
    const mapping = mappings.find((m) => m.eurostatDatasetCode === code);
    eurostatResults.push(await checkEurostat(code, mapping?.euFilterOverrides));
  }

  console.log(
    padCell("CODE", 16) +
      padCell("STATUS", 8) +
      padCell("UPDATED", 27) +
      padCell("YEARS", 12) +
      padCell("IL", 5) +
      padCell("EU", 12),
  );
  for (const r of eurostatResults) {
    console.log(
      padCell(r.code, 16) +
        padCell(r.ok ? "OK" : "FAIL", 8) +
        padCell(r.updated ?? "-", 27) +
        padCell(r.yearRange ? `${r.yearRange[0]}-${r.yearRange[1]}` : "-", 12) +
        padCell(r.hasIsrael ? "yes" : "no", 5) +
        padCell(r.euAggregateCode ?? "no", 12),
    );
    if (!r.ok) console.log(`    error: ${r.error}`);
  }

  console.log(`\nChecking ${mappings.length} CBS indicator(s) (from cbs-indicator-map.json)...\n`);
  const cbsResults: CbsCheckResult[] = [];
  for (const m of mappings) {
    cbsResults.push(await checkCbs(m));
  }
  if (mappings.length === 0) {
    console.log("  (none mapped yet — see scripts/discover-cbs.ts)");
  } else {
    console.log(padCell("CBS CODE", 16) + padCell("STATUS", 8) + padCell("UPDATED", 27) + padCell("YEARS", 12));
    for (const r of cbsResults) {
      console.log(
        padCell(r.code, 16) +
          padCell(r.ok ? "OK" : "FAIL", 8) +
          padCell(r.updated ?? "-", 27) +
          padCell(r.yearRange ? `${r.yearRange[0]}-${r.yearRange[1]}` : "-", 12),
      );
      if (!r.ok) console.log(`    error: ${r.error}`);
    }
  }

  const readyIndicators = mappings
    .filter((m) => {
      const eu = eurostatResults.find((r) => r.code === m.eurostatDatasetCode);
      const cbs = cbsResults.find((r) => r.code === m.cbsCode);
      return eu?.ok && cbs?.ok;
    })
    .map((m) => m.key);

  const report = {
    generatedAt: new Date().toISOString(),
    eurostat: eurostatResults,
    cbs: cbsResults,
    readyIndicators,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${REPORT_PATH}`);
  console.log(`Ready indicators (Eurostat+CBS both passing): ${readyIndicators.length ? readyIndicators.join(", ") : "(none)"}`);

  const anyEurostatFail = eurostatResults.some((r) => BASELINE_EUROSTAT_CODES.includes(r.code) && !r.ok);
  const anyCuratedFail = mappings.length > 0 && readyIndicators.length < mappings.length;
  if (anyEurostatFail || anyCuratedFail) {
    console.error("\nFAIL: a baseline dataset or a curated indicator failed to load.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
