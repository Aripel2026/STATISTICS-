import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchCbsSeries } from "../../../server-lib/cbsClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    res.status(400).json({ error: "Missing series id" });
    return;
  }
  const lang = req.query.lang === "he" ? "he" : "en";

  try {
    const result = await fetchCbsSeries(id, lang);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ source: "cbs", ...result });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch or parse CBS series data — no data was fabricated.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
