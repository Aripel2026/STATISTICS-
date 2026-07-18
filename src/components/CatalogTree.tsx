import { useState } from "react";
import type { TocNode } from "../lib/types";

interface CatalogTreeProps {
  node: TocNode;
  onSelectDataset: (code: string, title: string) => void;
  selectedCode: string | null;
}

interface TreeFolderProps extends CatalogTreeProps {
  path: string;
}

function TreeFolder({ node, onSelectDataset, selectedCode, path }: TreeFolderProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = node.children.length > 0 || node.datasets.length > 0;
  if (!hasContent) return null;

  return (
    <li className="tree-node">
      <div className="tree-node-label" onClick={() => setExpanded((e) => !e)}>
        <span>{expanded ? "▾" : "▸"}</span>
        <span>{node.title}</span>
      </div>
      {expanded && (
        <ul className="tree-list">
          {node.children.map((child, i) => (
            <TreeFolder
              key={`${path}/${i}-${child.id}`}
              node={child}
              onSelectDataset={onSelectDataset}
              selectedCode={selectedCode}
              path={`${path}/${i}-${child.id}`}
            />
          ))}
          {node.datasets.map((ds, i) => (
            <li
              key={`${path}/ds${i}-${ds.code}`}
              className="tree-leaf"
              aria-current={selectedCode === ds.code}
              onClick={() => onSelectDataset(ds.code, ds.title)}
            >
              {ds.title} <code style={{ opacity: 0.6 }}>{ds.code}</code>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CatalogTree({ node, onSelectDataset, selectedCode }: CatalogTreeProps) {
  return (
    <ul className="tree-list" style={{ paddingInlineStart: 0 }}>
      {node.children.map((child, i) => (
        <TreeFolder
          key={`${i}-${child.id}`}
          node={child}
          onSelectDataset={onSelectDataset}
          selectedCode={selectedCode}
          path={`${i}-${child.id}`}
        />
      ))}
    </ul>
  );
}
