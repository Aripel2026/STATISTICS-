export interface TocDataset {
  code: string;
  title: string;
  type: string;
  lastUpdate: string | null;
}

export interface TocNode {
  id: string;
  title: string;
  children: TocNode[];
  datasets: TocDataset[];
}

const TOC_URL = "https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en";
const INDENT_WIDTH = 4;

function parseTsvLine(line: string): string[] {
  // Fields are double-quoted and tab-separated; quotes never appear inside
  // field values in this feed, so a simple split + unquote is sufficient.
  return line.split("\t").map((field) => {
    const trimmed = field.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });
}

export function parseToc(raw: string): TocNode {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const root: TocNode = { id: "root", title: "Eurostat", children: [], datasets: [] };
  const stack: { depth: number; node: TocNode }[] = [{ depth: -1, node: root }];

  for (let i = 1; i < lines.length; i++) {
    const [rawTitle, code, type, lastUpdate] = parseTsvLine(lines[i]);
    if (!rawTitle || !code) continue;
    const leadingSpaces = rawTitle.length - rawTitle.trimStart().length;
    const depth = Math.round(leadingSpaces / INDENT_WIDTH);
    const title = rawTitle.trim();

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]?.node ?? root;

    if (type === "folder") {
      const node: TocNode = { id: code, title, children: [], datasets: [] };
      parent.children.push(node);
      stack.push({ depth, node });
    } else {
      parent.datasets.push({
        code,
        title,
        type,
        lastUpdate: lastUpdate && lastUpdate.trim() !== "" ? lastUpdate.trim() : null,
      });
    }
  }

  return root;
}

let cachedToc: { fetchedAt: number; tree: TocNode } | null = null;
const TOC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchToc(): Promise<TocNode> {
  if (cachedToc && Date.now() - cachedToc.fetchedAt < TOC_CACHE_TTL_MS) {
    return cachedToc.tree;
  }
  const res = await fetch(TOC_URL);
  if (!res.ok) {
    throw new Error(`Eurostat TOC request failed: ${res.status} ${res.statusText}`);
  }
  const raw = await res.text();
  const tree = parseToc(raw);
  cachedToc = { fetchedAt: Date.now(), tree };
  return tree;
}
