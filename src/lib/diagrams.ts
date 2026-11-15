import type { AnalysisResult, Diagram, CodeFile } from './types';

const IMPORT_JS = /(?:import\s[^'"]*?from\s*|import\s*|export\s[^'"]*?from\s*|require\s*\()\s*['"]([^'"]+)['"]/g;
const IMPORT_PY = /^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.,\s]+))/gm;
const IMPORT_GO = /import\s*(?:\(\s*)?(?:[^)]*?)["']([^"']+)["']/g;

function normalizePath(base: string, rel: string): string {
  const parts = base.split('/').slice(0, -1);
  for (const seg of rel.split('/')) {
    if (seg === '.' || seg === '') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function moduleOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root)';
  // Use top-level dir, but collapse src/<dir> to src/<dir> for depth-2 clarity
  if (parts[0] === 'src' && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

function mermaidId(prefix: string, index: number): string {
  return `${prefix}${index}`;
}

function safeLabel(text: string): string {
  return text.replace(/["&]/g, ' ').replace(/[\[\]{}()<>/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function buildImportGraph(files: CodeFile[]): Map<string, Map<string, number>> {
  const edges = new Map<string, Map<string, number>>();
  const fileSet = new Set(files.map((f) => f.path));

  const addEdge = (from: string, to: string) => {
    if (!from || !to || from === to) return;
    const map = edges.get(from) ?? new Map<string, number>();
    map.set(to, (map.get(to) ?? 0) + 1);
    edges.set(from, map);
  };

  for (const f of files) {
    const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
    const isPy = ext === 'py';
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte'].includes(ext)) {
      for (const m of f.content.matchAll(IMPORT_JS)) {
        const spec = m[1];
        if (!spec.startsWith('.')) continue;
        let resolved = normalizePath(f.path, spec);
        // resolve extension
        const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`, `${resolved}.mjs`, `${resolved}/index.ts`, `${resolved}/index.tsx`, `${resolved}/index.js`];
        const hit = candidates.find((c) => fileSet.has(c));
        if (hit) resolved = hit;
        addEdge(moduleOf(f.path), moduleOf(resolved));
      }
    } else if (isPy) {
      for (const m of f.content.matchAll(IMPORT_PY)) {
        const spec = (m[1] ?? m[2] ?? '').split(',')[0].trim().replace(/\./g, '/');
        if (!spec || spec.startsWith('/')) continue;
        // relative-ish: try to find matching top package in repo (absolute import → match top-level dir of spec)
        const top = spec.split('/')[0];
        const targetDir = files.find((other) => other.path === `${top}/__init__.py` || other.path.startsWith(`${top}/`));
        if (targetDir) addEdge(moduleOf(f.path), top);
      }
    } else if (ext === 'go') {
      for (const m of f.content.matchAll(IMPORT_GO)) {
        const spec = m[1];
        const top = spec.split('/')[0];
        if (['github.com', 'gopkg.in', 'go.uber.org', 'golang.org', 'gopkg'].includes(top)) continue;
        const localDir = files.find((other) => other.path.startsWith(`${top}/`));
        if (localDir) addEdge(moduleOf(f.path), top);
      }
    }
  }
  return edges;
}

function buildArchitectureDiagram(files: CodeFile[], projectName: string): Diagram {
  const edges = buildImportGraph(files);
  const nodeWeight = new Map<string, number>();
  const edgeList: { from: string; to: string; weight: number }[] = [];
  for (const [from, targets] of edges) {
    for (const [to, weight] of targets) {
      if (from === to) continue;
      edgeList.push({ from, to, weight });
      nodeWeight.set(from, (nodeWeight.get(from) ?? 0) + weight);
      nodeWeight.set(to, (nodeWeight.get(to) ?? 0) + weight);
    }
  }
  edgeList.sort((a, b) => b.weight - a.weight);
  const topEdges = edgeList.slice(0, 25);
  const nodes = new Set<string>();
  for (const e of topEdges) { nodes.add(e.from); nodes.add(e.to); }

  let mermaid: string;
  if (nodes.size === 0) {
    mermaid = `flowchart LR\n  solo["${safeLabel(projectName)}\\n(no cross-module imports detected)"]\n  style solo fill:#0e1611,stroke:#34f5a5,stroke-width:2px,color:#34f5a5`;
  } else {
    const idOf = new Map<string, string>();
    let i = 0;
    for (const node of nodes) { idOf.set(node, mermaidId('m', i)); i += 1; }
    const lines = ['flowchart LR'];
    for (const [node, id] of idOf) lines.push(`  ${id}["${safeLabel(node)}"]`);
    for (const e of topEdges) {
      lines.push(`  ${idOf.get(e.from)} -->|${e.weight}| ${idOf.get(e.to)}`);
    }
    lines.push('  classDef mod fill:#0e1611,stroke:#34f5a5,stroke-width:1.5px,color:#b8ffd9');
    lines.push(`  class ${[...idOf.values()].join(',')} mod`);
    mermaid = lines.join('\n');
  }

  return {
    id: 'architecture',
    title: 'Module Architecture',
    description: 'Cross-module import graph derived from static import analysis. Edge labels are import counts; thicker clusters = tighter coupling.',
    mermaid,
  };
}

function buildApiFlowDiagram(analysis: Pick<AnalysisResult, 'calls' | 'routes' | 'projectName'>): Diagram {
  const { calls, routes, projectName } = analysis;
  const matched = calls.filter((c) => c.matchedRoute).slice(0, 14);
  const external = calls.filter((c) => c.external).slice(0, 6);

  const clientFiles = [...new Set([...matched.map((c) => c.file), ...external.map((c) => c.file)])].slice(0, 8);

  const lines = ['flowchart LR'];
  const fileNode = (f: string) => `file_${Math.abs(hash(f)) % 100000}`;
  for (const f of clientFiles) {
    lines.push(`  ${fileNode(f)}["${safeLabel(f.split('/').pop() ?? f)}"]`);
  }

  lines.push('  subgraph API["API SURFACE"]');
  const routeNodeIds = new Map<string, string>();
  let ri = 0;
  for (const c of matched) {
    const key = `${c.method} ${c.matchedRoute}`;
    if (!routeNodeIds.has(key)) {
      routeNodeIds.set(key, `route_${ri}`);
      ri += 1;
    }
  }
  for (const [key, id] of routeNodeIds) {
    lines.push(`    ${id}["${safeLabel(key)}"]`);
  }
  lines.push('  end');

  for (const c of matched) {
    const routeId = routeNodeIds.get(`${c.method} ${c.matchedRoute}`);
    if (routeId) lines.push(`  ${fileNode(c.file)} -->|${c.method}| ${routeId}`);
  }

  if (external.length > 0) {
    lines.push('  ext["External services"]');
    for (const c of external) {
      let host = c.url;
      try { host = new URL(c.url).hostname; } catch { /* keep raw */ }
      lines.push(`  ${fileNode(c.file)} -.->|${safeLabel(host)}| ext`);
    }
  }

  if (matched.length === 0 && external.length === 0) {
    lines.push('  empty["No client-side HTTP calls detected"]');
  }

  lines.push('  classDef client fill:#0e1611,stroke:#5eead4,color:#c8fff0');
  lines.push('  classDef api fill:#0e1611,stroke:#34f5a5,color:#b8ffd9');
  lines.push('  classDef external fill:#1a1410,stroke:#fbbf24,color:#fde68a');
  lines.push('  classDef empty fill:#0e1611,stroke:#3b4a40,color:#8aa695');
  if (clientFiles.length) lines.push(`  class ${clientFiles.map(fileNode).join(',')} client`);
  if (routeNodeIds.size) lines.push(`  class ${[...routeNodeIds.values()].join(',')} api`);
  if (external.length) lines.push('  class ext external');
  if (matched.length === 0 && external.length === 0) lines.push('  class empty empty');

  return {
    id: 'api-flow',
    title: 'Client → API Flow',
    description: `HTTP call sites statically linked to server routes in ${safeLabel(projectName)}. Dashed edges go to external services.`,
    mermaid: lines.join('\n'),
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function buildStackMindmap(analysis: AnalysisResult): Diagram {
  const lines = ['flowchart TD'];
  lines.push(`  root["${safeLabel(analysis.projectName)}"]`);
  let group = 0;
  const groups: { title: string; items: string[] }[] = [];
  if (analysis.languages.length) groups.push({ title: 'Languages', items: analysis.languages.slice(0, 6).map((l) => `${l.language} ${l.pct.toFixed(0)}%`) });
  if (analysis.frameworks.length) groups.push({ title: 'Frameworks', items: analysis.frameworks.slice(0, 8) });
  if (analysis.dependencies.length) {
    const runtime = analysis.dependencies.filter((d) => d.type === 'runtime').length;
    const dev = analysis.dependencies.filter((d) => d.type === 'dev').length;
    groups.push({ title: 'Dependencies', items: [`${runtime} runtime`, `${dev} dev`] });
  }
  if (analysis.scripts.length) groups.push({ title: 'Scripts', items: analysis.scripts.slice(0, 6).map((s) => s.name) });
  if (analysis.entryPoints.length) groups.push({ title: 'Entry points', items: analysis.entryPoints.slice(0, 5) });

  for (let gi = 0; gi < groups.length; gi += 1) {
    const gid = `g${gi}`;
    lines.push(`  ${gid}["${safeLabel(groups[gi].title.toUpperCase())}"]`);
    lines.push(`  root --> ${gid}`);
    groups[gi].items.forEach((item, i) => {
      const iid = `${gid}_${i}`;
      lines.push(`  ${iid}["${safeLabel(item)}"]`);
      lines.push(`  ${gid} --> ${iid}`);
    });
  }

  const groupIds: string[] = [];
  const leafIds: string[] = [];
  for (let gi = 0; gi < groups.length; gi += 1) {
    groupIds.push(`g${gi}`);
    groups[gi].items.forEach((_, i) => leafIds.push(`g${gi}_${i}`));
  }
  lines.push('  classDef root fill:#34f5a5,stroke:#0e1611,color:#060a08,stroke-width:2px,font-weight:bold');
  lines.push('  classDef grp fill:#0e1611,stroke:#34f5a5,stroke-width:1.5px,color:#b8ffd9,font-weight:bold');
  lines.push('  classDef leaf fill:#101b14,stroke:#2c4a3a,color:#cdeee0');
  lines.push('  class root root');
  if (groupIds.length) lines.push(`  class ${groupIds.join(',')} grp`);
  if (leafIds.length) lines.push(`  class ${leafIds.join(',')} leaf`);
  return {
    id: 'stack',
    title: 'Technology Stack',
    description: 'What the project is made of — languages, frameworks, dependencies, scripts and entry points.',
    mermaid: lines.join('\n'),
  };
}

function buildLanguagePie(analysis: AnalysisResult): Diagram {
  const top = analysis.languages.slice(0, 8);
  const lines = ['pie showData', '  title Lines of code by language'];
  for (const l of top) {
    lines.push(`  "${safeLabel(l.language)}" : ${Math.max(1, l.lines)}`);
  }
  return {
    id: 'languages',
    title: 'Language Distribution',
    description: 'Share of total lines of code across the codebase.',
    mermaid: lines.join('\n'),
  };
}

export function buildDiagrams(files: CodeFile[], analysis: AnalysisResult): Diagram[] {
  return [
    buildArchitectureDiagram(files, analysis.projectName),
    buildApiFlowDiagram(analysis),
    buildStackMindmap(analysis),
    buildLanguagePie(analysis),
  ];
}
