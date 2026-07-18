import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchToc } from "../../server-lib/eurostatToc";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const tree = await fetchToc();
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json(tree);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch the Eurostat catalog table of contents.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
