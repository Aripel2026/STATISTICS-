import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, "..", "..", "data", "cbs-indicator-map.json");

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const mappings = JSON.parse(readFileSync(MAP_PATH, "utf-8"));
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(mappings);
  } catch {
    res.status(200).json([]);
  }
}
