import type { Advisory, CodeFile, Dependency, Severity } from './types';
import { compareVersions, stripVersionPrefix } from './util';

const MAX_DEPS = 1500;

function pushDep(list: Dependency[], dep: Dependency) {
  if (list.length < MAX_DEPS) list.push(dep);
}

function parsePackageJson(f: CodeFile, deps: Dependency[]) {
  try {
    const json = JSON.parse(f.content);
    const grab = (section: string, type: Dependency['type']) => {
      const block = json?.[section];
      if (block && typeof block === 'object') {
        for (const [name, versionRaw] of Object.entries(block)) {
          pushDep(deps, {
            name,
            version: String(versionRaw),
            type,
            manager: 'npm',
            manifest: f.path,
          });
        }
      }
    };
    grab('dependencies', 'runtime');
    grab('devDependencies', 'dev');
    grab('peerDependencies', 'peer');
  } catch {
    /* unparseable manifest — skip */
  }
}

function parseRequirementsTxt(f: CodeFile, deps: Dependency[]) {
  for (const rawLine of f.content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('-r') || line.startsWith('-e') || line.startsWith('--')) continue;
    const withoutMarker = line.split(';')[0].split('#')[0].trim();
    const m = withoutMarker.match(/^([A-Za-z0-9._-]+)\s*(?:\[[^\]]*\])?\s*(?:(==|>=|<=|~=|!=|>|<)\s*([A-Za-z0-9.*+!-]+))?/);
    if (!m) continue;
    pushDep(deps, { name: m[1].toLowerCase(), version: m[3] ?? 'unpinned', type: 'runtime', manager: 'pip', manifest: f.path });
  }
}

function parsePyproject(f: CodeFile, deps: Dependency[]) {
  const text = f.content;
  const arrayMatch = text.match(/dependencies\s*=\s*\[([^\]]*)\]/s);
  if (arrayMatch) {
    for (const m of arrayMatch[1].matchAll(/["']([A-Za-z0-9._-]+)(?:\[[^\]]*\])?\s*(?:(==|>=|<=|~=|!=|>|<)\s*([A-Za-z0-9.*+!-]+))?["']/g)) {
      pushDep(deps, { name: m[1].toLowerCase(), version: m[3] ?? 'unpinned', type: 'runtime', manager: 'pip', manifest: f.path });
    }
  }
  const poetryMatch = text.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/);
  if (poetryMatch) {
    for (const rawLine of poetryMatch[1].split('\n')) {
      const m = rawLine.match(/^([A-Za-z0-9._-]+)\s*=\s*["'^]?([~^>=<\s]*[A-Za-z0-9.*+-]+)?/);
      if (m && m[1].toLowerCase() !== 'python') {
        pushDep(deps, { name: m[1].toLowerCase(), version: (m[2] ?? 'unpinned').trim() || 'unpinned', type: 'runtime', manager: 'pip', manifest: f.path });
      }
    }
  }
  const poetryDev = text.match(/\[tool\.poetry\.group\.dev\.dependencies\]([\s\S]*?)(\n\[|$)/);
  if (poetryDev) {
    for (const rawLine of poetryDev[1].split('\n')) {
      const m = rawLine.match(/^([A-Za-z0-9._-]+)\s*=\s*["'^]?([~^>=<\s]*[A-Za-z0-9.*+-]+)?/);
      if (m) {
        pushDep(deps, { name: m[1].toLowerCase(), version: (m[2] ?? 'unpinned').trim() || 'unpinned', type: 'dev', manager: 'pip', manifest: f.path });
      }
    }
  }
}

function parseCargo(f: CodeFile, deps: Dependency[]) {
  const sections = f.content.split(/^\[/m);
  for (const section of sections) {
    const isDev = /^dev-dependencies\]/.test(section);
    const isPeer = /^build-dependencies\]/.test(section);
    if (!/^(dependencies|dev-dependencies|build-dependencies)\]/.test(section)) continue;
    const untilNextSection = section.split(/\n\[/)[0];
    for (const rawLine of untilNextSection.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('[')) continue;
      const tableStyle = line.match(/^([A-Za-z0-9._-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
      const simpleStyle = line.match(/^([A-Za-z0-9._-]+)\s*=\s*"([^"]+)"/);
      const m = tableStyle ?? simpleStyle;
      if (m) {
        pushDep(deps, { name: m[1], version: m[2], type: isDev ? 'dev' : isPeer ? 'dev' : 'runtime', manager: 'cargo', manifest: f.path });
      }
    }
  }
}

function parseGoMod(f: CodeFile, deps: Dependency[]) {
  for (const rawLine of f.content.split('\n')) {
    let line = rawLine.trim();
    if (line.startsWith('require ')) line = line.slice('require '.length).trim();
    const m = line.match(/^([a-z0-9][a-z0-9.\-/_]+\.[a-z]+[a-z0-9.\-/_]*)\s+v([0-9][^\s]*)/i);
    if (m) {
      pushDep(deps, { name: m[1], version: `v${m[2]}`, type: 'runtime', manager: 'gomod', manifest: f.path });
    }
  }
}

function parsePom(f: CodeFile, deps: Dependency[]) {
  const blocks = f.content.match(/<dependency>[\s\S]*?<\/dependency>/g) ?? [];
  for (const block of blocks) {
    const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
    const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
    const v = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim();
    const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1]?.trim();
    if (!g || !a) continue;
    pushDep(deps, {
      name: `${g}:${a}`,
      version: v ?? 'managed',
      type: scope === 'test' ? 'dev' : 'runtime',
      manager: 'maven',
      manifest: f.path,
    });
  }
}

function parseGradle(f: CodeFile, deps: Dependency[]) {
  for (const rawLine of f.content.split('\n')) {
    const m = rawLine.match(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation|androidTestImplementation|compile)\s*\(?\s*['"]([^'"]+)['"]/);
    if (!m) continue;
    const parts = m[1].split(':');
    if (parts.length >= 2) {
      pushDep(deps, {
        name: `${parts[0]}:${parts[1]}`,
        version: parts[2] ?? 'unpinned',
        type: /test/i.test(rawLine) ? 'dev' : 'runtime',
        manager: 'gradle',
        manifest: f.path,
      });
    }
  }
}

function parseGemfile(f: CodeFile, deps: Dependency[]) {
  for (const rawLine of f.content.split('\n')) {
    const m = rawLine.match(/^\s*gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/);
    if (m) {
      pushDep(deps, { name: m[1], version: m[2] ?? 'unpinned', type: 'runtime', manager: 'bundler', manifest: f.path });
    }
  }
}

function parseComposer(f: CodeFile, deps: Dependency[]) {
  try {
    const json = JSON.parse(f.content);
    const grab = (section: string, type: Dependency['type']) => {
      const block = json?.[section];
      if (block && typeof block === 'object') {
        for (const [name, versionRaw] of Object.entries(block)) {
          if (name === 'php' || name.startsWith('ext-')) continue;
          pushDep(deps, { name, version: String(versionRaw), type, manager: 'composer', manifest: f.path });
        }
      }
    };
    grab('require', 'runtime');
    grab('require-dev', 'dev');
  } catch {
    /* skip */
  }
}

function parseCsproj(f: CodeFile, deps: Dependency[]) {
  for (const m of f.content.matchAll(/<PackageReference\s+Include="([^"]+)"[^>]*Version="([^"]+)"/g)) {
    pushDep(deps, { name: m[1], version: m[2], type: 'runtime', manager: 'nuget', manifest: f.path });
  }
}

export function extractDependencies(files: CodeFile[]): Dependency[] {
  const deps: Dependency[] = [];
  for (const f of files) {
    const base = (f.path.split('/').pop() ?? '').toLowerCase();
    if (base === 'package.json') parsePackageJson(f, deps);
    else if (/^requirements[^/]*\.txt$/.test(base)) parseRequirementsTxt(f, deps);
    else if (base === 'pyproject.toml') parsePyproject(f, deps);
    else if (base === 'cargo.toml') parseCargo(f, deps);
    else if (base === 'go.mod') parseGoMod(f, deps);
    else if (base === 'pom.xml') parsePom(f, deps);
    else if (/^build\.gradle(\.kts)?$/.test(base)) parseGradle(f, deps);
    else if (base === 'gemfile') parseGemfile(f, deps);
    else if (base === 'composer.json') parseComposer(f, deps);
    else if (base.endsWith('.csproj')) parseCsproj(f, deps);
  }
  return deps;
}

// ---------- built-in advisory database (offline heuristics) ----------

interface AdvisoryRule {
  name: string;
  below?: string;       // flag when installed version < this version
  always?: boolean;     // flag regardless of version (deprecation / malicious)
  severity: Severity;
  title: string;
  fix: string;
  manager: string[];
}

const ADVISORIES: AdvisoryRule[] = [
  { name: 'lodash', below: '4.17.21', severity: 'high', title: 'Prototype pollution (CVE-2020-8203, CVE-2021-23337)', fix: 'Upgrade to lodash >= 4.17.21', manager: ['npm'] },
  { name: 'lodash-es', below: '4.17.21', severity: 'high', title: 'Prototype pollution (CVE-2020-8203)', fix: 'Upgrade to lodash-es >= 4.17.21', manager: ['npm'] },
  { name: 'minimist', below: '1.2.6', severity: 'medium', title: 'Prototype pollution (CVE-2020-7598)', fix: 'Upgrade to minimist >= 1.2.6', manager: ['npm'] },
  { name: 'axios', below: '0.21.2', severity: 'high', title: 'SSRF via proxy redirect (CVE-2020-28168)', fix: 'Upgrade to axios >= 0.21.2 (or >= 1.8.x)', manager: ['npm'] },
  { name: 'axios', below: '1.8.2', severity: 'medium', title: 'SSRF / credential leak via absolute URLs (CVE-2024-39338, CVE-2025-27152)', fix: 'Upgrade to axios >= 1.8.2', manager: ['npm'] },
  { name: 'node-fetch', below: '2.6.7', severity: 'medium', title: 'Exposure of sensitive information (CVE-2022-0235)', fix: 'Upgrade to node-fetch >= 2.6.7', manager: ['npm'] },
  { name: 'json5', below: '2.2.2', severity: 'medium', title: 'Prototype pollution (CVE-2022-46175)', fix: 'Upgrade to json5 >= 2.2.2', manager: ['npm'] },
  { name: 'semver', below: '7.5.2', severity: 'medium', title: 'ReDoS in semver parsing (CVE-2022-25883)', fix: 'Upgrade to semver >= 7.5.2', manager: ['npm'] },
  { name: 'tar', below: '6.2.1', severity: 'high', title: 'Arbitrary file overwrite (CVE-2021-37713)', fix: 'Upgrade to tar >= 6.2.1', manager: ['npm'] },
  { name: 'event-stream', below: '3.3.7', severity: 'critical', title: 'Malicious dependency payload via flatmap-stream (CVE-2018-16492)', fix: 'Remove event-stream, pin clean deps, run npm audit', manager: ['npm'] },
  { name: 'ua-parser-js', below: '0.7.33', severity: 'high', title: 'Development-mode malware injection (CVE-2021-42642)', fix: 'Upgrade to ua-parser-js >= 0.7.33', manager: ['npm'] },
  { name: 'follow-redirects', below: '1.15.4', severity: 'medium', title: 'Leak of authentication headers on redirect (CVE-2024-28849)', fix: 'Upgrade to follow-redirects >= 1.15.4', manager: ['npm'] },
  { name: 'express', below: '4.19.2', severity: 'medium', title: 'Open redirect in malformed URLs (CVE-2024-29041)', fix: 'Upgrade to express >= 4.19.2', manager: ['npm'] },
  { name: 'jsonwebtoken', below: '9.0.0', severity: 'high', title: 'Insecure algorithm defaults / weak key handling (CVE-2022-23529 family)', fix: 'Upgrade to jsonwebtoken >= 9.0.0 and set algorithms explicitly', manager: ['npm'] },
  { name: 'got', below: '11.8.5', severity: 'medium', title: 'Redirect to UNIX socket / file:// (CVE-2022-33987)', fix: 'Upgrade to got >= 11.8.5', manager: ['npm'] },
  { name: 'hosted-git-info', below: '3.0.8', severity: 'medium', title: 'ReDoS (CVE-2021-23362)', fix: 'Upgrade to hosted-git-info >= 3.0.8', manager: ['npm'] },
  { name: 'request', always: true, severity: 'medium', title: 'Deprecated and unmaintained HTTP client', fix: 'Migrate to undici, got or axios', manager: ['npm'] },
  { name: 'moment', always: true, severity: 'info', title: 'Legacy library, heavy bundle, in maintenance mode', fix: 'Prefer dayjs, date-fns or Intl.DateTimeFormat', manager: ['npm'] },
  { name: 'node-sass', always: true, severity: 'info', title: 'Deprecated, native build pain', fix: 'Migrate to dart-sass (sass package)', manager: ['npm'] },
  { name: 'urllib3', below: '1.26.5', severity: 'medium', title: 'ReDoS and header injection (CVE-2021-33503, CVE-2021-28363)', fix: 'Upgrade to urllib3 >= 1.26.5', manager: ['pip'] },
  { name: 'requests', below: '2.20.0', severity: 'medium', title: 'Redirect leaks Authorization header to 3rd party (CVE-2018-18074)', fix: 'Upgrade to requests >= 2.20.0', manager: ['pip'] },
  { name: 'pyyaml', below: '5.4', severity: 'medium', title: 'Arbitrary code execution via FullLoader (CVE-2020-14343)', fix: 'Upgrade to PyYAML >= 5.4', manager: ['pip'] },
  { name: 'jinja2', below: '2.11.3', severity: 'medium', title: 'ReDoS and sandbox breakout (CVE-2020-28493)', fix: 'Upgrade to Jinja2 >= 2.11.3', manager: ['pip'] },
  { name: 'django', below: '3.2', severity: 'high', title: 'Multiple CVEs fixed after 3.2 LTS line', fix: 'Upgrade to a supported Django LTS (4.2 / 5.x)', manager: ['pip'] },
];

export function findAdvisories(deps: Dependency[]): Advisory[] {
  const out: Advisory[] = [];
  const seen = new Set<string>();
  for (const dep of deps) {
    const nameLower = dep.name.toLowerCase();
    for (const rule of ADVISORIES) {
      if (rule.name !== nameLower) continue;
      if (!rule.manager.includes(dep.manager)) continue;
      if (rule.always) {
        const key = `${dep.manager}:${nameLower}:always`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: dep.name, version: dep.version, severity: rule.severity, title: rule.title, fix: rule.fix, manager: dep.manager });
        continue;
      }
      if (rule.below) {
        const v = stripVersionPrefix(dep.version);
        if (!/^\d/.test(v)) continue;
        if (compareVersions(v, rule.below) < 0) {
          const key = `${dep.manager}:${nameLower}:${rule.below}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ name: dep.name, version: dep.version, severity: rule.severity, title: rule.title, fix: rule.fix, manager: dep.manager });
        }
      }
    }
  }
  return out;
}
