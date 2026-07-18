import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchCbsPriceIndex } from "../../../server-lib/cbsClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    res.status(400).json({ error: "Missing price index code" });
    return;
  }
  const lang = req.query.lang === "he" ? "he" : "en";
  const valueKind = req.query.value === "level" ? "level" : "yoy";

  try {
    const result = await fetchCbsPriceIndex(id, valueKind, lang);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ source: "cbs", ...result });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch or parse CBS price index — no data was fabricated.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
