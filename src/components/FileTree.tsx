import { useMemo, useState } from 'react';
import type { TreeNode } from '../lib/types';
import { IconChevronRight, IconChevronDown, IconFolder } from './icons';
import { formatBytes } from '../lib/util';

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#5eead4', JavaScript: '#fde68a', Python: '#a7f3d0', Java: '#fdba74', Go: '#7dd3fc',
  Rust: '#fda4af', Ruby: '#fca5a5', PHP: '#c4b5fd', 'C#': '#86efac', C: '#cbd5e1', 'C++': '#cbd5e1',
  HTML: '#fdba74', CSS: '#93c5fd', SCSS: '#f9a8d4', JSON: '#fcd34d', YAML: '#f0abfc', Markdown: '#e2e8f0',
  Shell: '#86efac', SQL: '#a5f3fc', Vue: '#6ee7b7', Svelte: '#fca5a5',
};

interface FileTreeProps {
  root: TreeNode;
  findingsByFile: Map<string, number>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (!query) return node;
  const q = query.toLowerCase();
  if (node.type === 'file') {
    return node.path.toLowerCase().includes(q) ? node : null;
  }
  const children = node.children.map((c) => filterTree(c, q)).filter((c): c is TreeNode => c !== null);
  const dirMatches = node.path.toLowerCase().includes(q);
  if (children.length === 0 && !dirMatches) return null;
  if (dirMatches && children.length === 0) return node;
  return { ...node, children };
}

function collectDirs(node: TreeNode, depth: number, acc: string[]): string[] {
  if (node.type !== 'dir') return acc;
  if (depth <= 1) acc.push(node.path);
  for (const child of node.children) collectDirs(child, depth + 1, acc);
  return acc;
}

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  findingsByFile: Map<string, number>;
  forceExpand: boolean;
}

function TreeRow({ node, depth, expanded, toggle, selectedPath, onSelect, findingsByFile, forceExpand }: RowProps) {
  const isOpen = forceExpand || expanded.has(node.path);
  const isDir = node.type === 'dir';
  const findings = isDir ? 0 : findingsByFile.get(node.path) ?? 0;
  const color = !isDir && node.language ? LANG_COLORS[node.language] ?? '#9fb8a9' : '#34f5a5';

  const row = (
    <button
      className={`tree-row${selectedPath === node.path ? ' selected' : ''}`}
      style={{ paddingLeft: depth * 14 + 6 }}
      onClick={() => (isDir ? toggle(node.path) : onSelect(node.path))}
      title={node.path}
    >
      <span className="caret-r">
        {isDir ? (isOpen ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />) : ''}
      </span>
      {isDir
        ? <IconFolder size={13} />
        : <span className="tree-dot" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />}
      <span className="tree-name">{node.name}</span>
      {findings > 0 && <span className="tree-badge">{findings}</span>}
      <span className="tree-size">{isDir ? `${node.fileCount}` : formatBytes(node.size)}</span>
    </button>
  );

  return (
    <>
      {row}
      {isDir && isOpen && node.children.map((child) => (
        <TreeRow
          key={child.path || child.name}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
          findingsByFile={findingsByFile}
          forceExpand={forceExpand}
        />
      ))}
    </>
  );
}

export default function FileTree({ root, findingsByFile, selectedPath, onSelect }: FileTreeProps) {
  const [query, setQuery] = useState('');
  const defaultExpanded = useMemo(() => new Set(collectDirs(root, 0, [])), [root]);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const effectiveExpanded = expanded ?? defaultExpanded;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const base = new Set(prev ?? defaultExpanded);
      if (base.has(path)) base.delete(path); else base.add(path);
      return base;
    });
  };

  const filtered = useMemo(() => filterTree(root, query.trim()), [root, query]);
  const forceExpand = query.trim().length > 0;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 0' }}>
        <input
          className="input search-input"
          style={{ width: '100%' }}
          placeholder="Filter files… (e.g. .env, route, auth)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter files in tree"
        />
      </div>
      <div className="tree">
        {filtered ? (
          <TreeRow
            node={filtered}
            depth={0}
            expanded={effectiveExpanded}
            toggle={toggle}
            selectedPath={selectedPath}
            onSelect={onSelect}
            findingsByFile={findingsByFile}
            forceExpand={forceExpand}
          />
        ) : (
          <div className="muted" style={{ padding: 18, textAlign: 'center', fontSize: 12 }}>No files match “{query}”.</div>
        )}
      </div>
    </div>
  );
}
