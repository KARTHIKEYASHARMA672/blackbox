export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CodeFile {
  path: string;
  size: number;
  content: string;
  truncated: boolean;
  language: string | null;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface LanguageStat {
  language: string;
  files: number;
  lines: number;
  bytes: number;
  pct: number;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  language?: string | null;
  children: TreeNode[];
  fileCount: number;
  size: number;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  manager: string;
  manifest: string;
}

export interface Advisory {
  name: string;
  version: string;
  severity: Severity;
  title: string;
  fix: string;
  manager: string;
}

export interface ApiRoute {
  method: string;
  path: string;
  framework: string;
  file: string;
  line: number;
}

export interface ApiCall {
  method: string;
  url: string;
  client: string;
  file: string;
  line: number;
  external: boolean;
  matchedRoute: string | null;
}

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  remediation: string;
  file: string;
  line: number;
  snippet: string;
}

export interface Diagram {
  id: string;
  title: string;
  description: string;
  mermaid: string;
}

export interface AnalysisResult {
  projectName: string;
  scannedAt: number;
  durationMs: number;
  files: CodeFile[];
  skipped: SkippedFile[];
  totals: {
    files: number;
    bytes: number;
    lines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  };
  languages: LanguageStat[];
  tree: TreeNode;
  topDirs: { name: string; files: number; lines: number; bytes: number }[];
  frameworks: string[];
  projectTypes: string[];
  entryPoints: string[];
  scripts: { name: string; command: string }[];
  dependencies: Dependency[];
  advisories: Advisory[];
  routes: ApiRoute[];
  calls: ApiCall[];
  findings: Finding[];
  score: number;
  grade: string;
  riskLabel: string;
  riskColor: string;
  diagrams: Diagram[];
}

export type WorkspaceTab =
  | 'overview'
  | 'structure'
  | 'diagrams'
  | 'dependencies'
  | 'api'
  | 'security'
  | 'docs'
  | 'settings';

export interface LLMConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}
