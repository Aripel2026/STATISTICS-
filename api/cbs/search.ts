import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCbsIndex, searchCbsIndex } from "../../server-lib/cbsIndex.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const qParam = req.query.q;
  const q = Array.isArray(qParam) ? qParam[0] : qParam;
  if (!q || q.trim().length < 2) {
    res.status(200).json([]);
    return;
  }
  try {
    const index = await getCbsIndex();
    const results = searchCbsIndex(index, q);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json(results);
  } catch (err) {
    res.status(502).json({
      error: "Failed to search CBS series.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
