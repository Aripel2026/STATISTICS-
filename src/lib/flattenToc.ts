import type { FlatIndicator, TocNode } from "./types";

export function flattenToc(node: TocNode, breadcrumb: string[] = []): FlatIndicator[] {
  const out: FlatIndicator[] = [];
  for (const ds of node.datasets) {
    out.push({ code: ds.code, title: ds.title, type: ds.type, breadcrumb });
  }
  for (const child of node.children) {
    out.push(...flattenToc(child, [...breadcrumb, child.title]));
  }
  return out;
}

export function searchFlatIndicators(list: FlatIndicator[], query: string, limit = 40): FlatIndicator[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = list.filter((d) => d.title.toLowerCase().includes(q) || d.code.toLowerCase() === q);
  matches.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
  return matches.slice(0, limit);
}
