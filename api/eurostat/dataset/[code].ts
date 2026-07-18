import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchEurostatDataset } from "../../../server-lib/eurostatClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code;
  const datasetCode = Array.isArray(code) ? code[0] : code;
  if (!datasetCode) {
    res.status(400).json({ error: "Missing dataset code" });
    return;
  }

  try {
    const result = await fetchEurostatDataset(datasetCode);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ source: "eurostat", ...result });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch or parse Eurostat dataset — no data was fabricated.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
