import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchCbsTopLevel } from "../../server-lib/cbsClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lang = req.query.lang === "he" ? "he" : "en";
  try {
    const categories = await fetchCbsTopLevel(lang);
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json(categories);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch the CBS top-level catalog.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
