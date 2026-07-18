import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchCbsLeafSeries } from "../../server-lib/cbsClient";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    res.status(400).json({ error: "Missing top-level category id" });
    return;
  }
  const pageParam = req.query.page;
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : (pageParam ?? "1")) || 1;
  const lang = req.query.lang === "he" ? "he" : "en";

  try {
    const series = await fetchCbsLeafSeries(id, page, 100, lang);
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json(series);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch CBS leaf series for this category.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
