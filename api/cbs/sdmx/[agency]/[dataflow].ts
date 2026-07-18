import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchCbsSdmx } from "../../../../server-lib/cbsClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const agencyParam = req.query.agency;
  const dataflowParam = req.query.dataflow;
  const agency = Array.isArray(agencyParam) ? agencyParam[0] : agencyParam;
  const dataflow = Array.isArray(dataflowParam) ? dataflowParam[0] : dataflowParam;
  if (!agency || !dataflow) {
    res.status(400).json({ error: "Missing agency or dataflow" });
    return;
  }
  const versionParam = req.query.version;
  const version = (Array.isArray(versionParam) ? versionParam[0] : versionParam) ?? "1";

  try {
    const result = await fetchCbsSdmx(agency, dataflow, version);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ source: "cbs", ...result });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch or parse CBS SDMX data — no data was fabricated.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
