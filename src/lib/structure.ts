import type { CodeFile, LanguageStat, TreeNode } from './types';

const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.pyw': 'Python',
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin', '.scala': 'Scala', '.groovy': 'Groovy',
  '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.erb': 'Ruby',
  '.php': 'PHP', '.phtml': 'PHP',
  '.cs': 'C#', '.fs': 'F#', '.vb': 'VB.NET',
  '.c': 'C', '.h': 'C/C++ Header', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C/C++ Header',
  '.swift': 'Swift', '.m': 'Objective-C',
  '.dart': 'Dart', '.lua': 'Lua', '.r': 'R', '.jl': 'Julia',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.ps1': 'PowerShell', '.bat': 'Batch', '.cmd': 'Batch',
  '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.html': 'HTML', '.htm': 'HTML', '.vue': 'Vue', '.svelte': 'Svelte', '.astro': 'Astro',
  '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.xml': 'XML',
  '.md': 'Markdown', '.mdx': 'Markdown', '.rst': 'reStructuredText', '.txt': 'Text',
  '.env': 'Env', '.ini': 'INI', '.cfg': 'Config', '.conf': 'Config', '.properties': 'Properties',
  '.proto': 'Protobuf', '.tf': 'Terraform', '.hcl': 'HCL', '.dockerfile': 'Dockerfile',
};

const BASENAME_LANG: Record<string, string> = {
  dockerfile: 'Dockerfile', makefile: 'Makefile', rakefile: 'Ruby', gemfile: 'Ruby',
  procfile: 'Procfile', '.gitignore': 'Ignore File', '.env': 'Env', '.npmrc': 'Config',
  'cmakelists.txt': 'CMake', vagrantfile: 'Ruby', jenkinsfile: 'Jenkins',
};

export function detectLanguage(path: string): string | null {
  const base = (path.split('/').pop() ?? path).toLowerCase();
  if (BASENAME_LANG[base]) return BASENAME_LANG[base];
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = base.slice(dot);
  return EXT_LANG[ext] ?? null;
}

type CommentStyle = 'slash' | 'hash' | 'dash' | null;
const COMMENT_STYLE: Record<string, CommentStyle> = {
  TypeScript: 'slash', JavaScript: 'slash', Java: 'slash', Kotlin: 'slash', Scala: 'slash',
  Go: 'slash', Rust: 'slash', C: 'slash', 'C++': 'slash', 'C/C++ Header': 'slash',
  'C#': 'slash', Swift: 'slash', 'Objective-C': 'slash', PHP: 'slash', Vue: 'slash', Svelte: 'slash',
  Astro: 'slash', CSS: null, SCSS: 'slash', Sass: null, Less: 'slash', Protobuf: 'slash',
  GraphQL: 'hash',
  Python: 'hash', Ruby: 'hash', Shell: 'hash', PowerShell: 'hash', YAML: 'hash', TOML: 'hash',
  INI: 'hash', Config: 'hash', Env: 'hash', R: 'hash', Julia: 'hash', Ignore: 'hash', Dockerfile: 'hash',
  Terraform: 'hash', HCL: 'hash', Makefile: 'hash',
  SQL: 'dash',
};

export interface LocStats { lines: number; codeLines: number; commentLines: number; blankLines: number }

export function countLines(content: string, language: string | null): LocStats {
  const style = language ? COMMENT_STYLE[language] ?? null : null;
  const rows = content.split('\n');
  let code = 0, comment = 0, blank = 0;
  let inBlock = false;
  for (const raw of rows) {
    const line = raw.trim();
    if (line === '') { blank += 1; continue; }
    if (style === 'slash') {
      if (inBlock) {
        comment += 1;
        const end = line.indexOf('*/');
        if (end !== -1) inBlock = false;
        continue;
      }
      const blockStart = line.indexOf('/*');
      const lineComment = line.indexOf('//');
      if (lineComment !== -1 && (blockStart === -1 || lineComment < blockStart)) { comment += 1; continue; }
      if (blockStart !== -1) {
        comment += 1;
        if (!line.slice(blockStart + 2).includes('*/')) inBlock = true;
        continue;
      }
      code += 1; continue;
    }
    if (style === 'hash') {
      if (line.startsWith('#')) comment += 1; else code += 1;
      continue;
    }
    if (style === 'dash') {
      if (line.startsWith('--')) comment += 1; else code += 1;
      continue;
    }
    code += 1;
  }
  return { lines: rows.length, codeLines: code, commentLines: comment, blankLines: blank };
}

function buildTree(files: CodeFile[], projectName: string): TreeNode {
  const root: TreeNode = { name: projectName, path: '', type: 'dir', children: [], fileCount: 0, size: 0 };
  const dirMap = new Map<string, TreeNode>();
  dirMap.set('', root);

  const ensureDir = (segments: string[]): TreeNode => {
    let currentPath = '';
    let current = root;
    for (const seg of segments) {
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      const existing = dirMap.get(currentPath);
      if (existing) { current = existing; continue; }
      const node: TreeNode = { name: seg, path: currentPath, type: 'dir', children: [], fileCount: 0, size: 0 };
      current.children.push(node);
      dirMap.set(currentPath, node);
      current = node;
    }
    return current;
  };

  for (const f of files) {
    const parts = f.path.split('/');
    const fileName = parts.pop() ?? f.path;
    const parent = ensureDir(parts);
    parent.children.push({
      name: fileName,
      path: f.path,
      type: 'file',
      language: f.language,
      children: [],
      fileCount: 1,
      size: f.size,
    });
  }

  const sortAndAccumulate = (node: TreeNode): { fileCount: number; size: number } => {
    if (node.type === 'file') return { fileCount: 1, size: node.size };
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    let fc = 0, sz = 0;
    for (const child of node.children) {
      const agg = sortAndAccumulate(child);
      fc += agg.fileCount;
      sz += agg.size;
    }
    node.fileCount = fc;
    node.size = sz;
    return { fileCount: fc, size: sz };
  };
  sortAndAccumulate(root);
  return root;
}

export interface StructureReport {
  totals: { files: number; bytes: number; lines: number; codeLines: number; commentLines: number; blankLines: number };
  languages: LanguageStat[];
  tree: TreeNode;
  topDirs: { name: string; files: number; lines: number; bytes: number }[];
  frameworks: string[];
  projectTypes: string[];
  entryPoints: string[];
  scripts: { name: string; command: string }[];
}

function readPackageJson(files: CodeFile[]): { path: string; json: any } | null {
  for (const f of files) {
    if (/(^|\/)package\.json$/.test(f.path) && f.content) {
      try {
        return { path: f.path, json: JSON.parse(f.content) };
      } catch {
        return null;
      }
    }
  }
  return null;
}

const FRAMEWORK_DETECT: { name: string; test: (ctx: DetectCtx) => boolean }[] = [
  { name: 'React', test: (c) => c.pkgDeps.has('react') || c.pkgDeps.has('react-dom') },
  { name: 'Vue', test: (c) => c.pkgDeps.has('vue') || c.pkgDeps.has('nuxt') },
  { name: 'Angular', test: (c) => c.pkgDeps.has('@angular/core') },
  { name: 'Svelte', test: (c) => c.pkgDeps.has('svelte') || c.pkgDeps.has('@sveltejs/kit') },
  { name: 'Next.js', test: (c) => c.pkgDeps.has('next') },
  { name: 'Nuxt', test: (c) => c.pkgDeps.has('nuxt') },
  { name: 'Express', test: (c) => c.pkgDeps.has('express') },
  { name: 'Fastify', test: (c) => c.pkgDeps.has('fastify') },
  { name: 'NestJS', test: (c) => c.pkgDeps.has('@nestjs/core') },
  { name: 'Koa', test: (c) => c.pkgDeps.has('koa') },
  { name: 'Hono', test: (c) => c.pkgDeps.has('hono') },
  { name: 'Vite', test: (c) => c.pkgDeps.has('vite') },
  { name: 'Tailwind CSS', test: (c) => c.pkgDeps.has('tailwindcss') },
  { name: 'Prisma', test: (c) => c.pkgDeps.has('prisma') || c.pkgDeps.has('@prisma/client') },
  { name: 'Mongoose', test: (c) => c.pkgDeps.has('mongoose') },
  { name: 'Sequelize', test: (c) => c.pkgDeps.has('sequelize') },
  { name: 'TypeORM', test: (c) => c.pkgDeps.has('typeorm') },
  { name: 'Electron', test: (c) => c.pkgDeps.has('electron') },
  { name: 'React Native', test: (c) => c.pkgDeps.has('react-native') },
  { name: 'Expo', test: (c) => c.pkgDeps.has('expo') },
  { name: 'Socket.IO', test: (c) => c.pkgDeps.has('socket.io') },
  { name: 'GraphQL', test: (c) => c.pkgDeps.has('graphql') || c.pkgDeps.has('apollo-server') || c.pkgDeps.has('@apollo/server') },
  { name: 'Jest', test: (c) => c.pkgDeps.has('jest') || c.pkgDeps.has('vitest') },
  { name: 'Flask', test: (c) => c.pipDeps.has('flask') },
  { name: 'Django', test: (c) => c.pipDeps.has('django') },
  { name: 'FastAPI', test: (c) => c.pipDeps.has('fastapi') },
  { name: 'SQLAlchemy', test: (c) => c.pipDeps.has('sqlalchemy') },
  { name: 'PyTorch', test: (c) => c.pipDeps.has('torch') },
  { name: 'TensorFlow', test: (c) => c.pipDeps.has('tensorflow') },
  { name: 'Spring Boot', test: (c) => c.textIncludes('pom.xml', 'spring-boot') || c.textIncludes('build.gradle', 'spring-boot') },
  { name: 'Gin', test: (c) => c.textIncludes('go.mod', 'gin-gonic/gin') },
  { name: 'Echo', test: (c) => c.textIncludes('go.mod', 'labstack/echo') },
  { name: 'Fiber', test: (c) => c.textIncludes('go.mod', 'gofiber/fiber') },
  { name: 'Actix Web', test: (c) => c.textIncludes('cargo.toml', 'actix-web') },
  { name: 'Axum', test: (c) => c.textIncludes('cargo.toml', 'axum') },
  { name: 'Ruby on Rails', test: (c) => c.textIncludes('gemfile', "gem 'rails'") || c.textIncludes('gemfile', 'gem "rails"') },
  { name: 'Laravel', test: (c) => c.textIncludes('composer.json', 'laravel/framework') },
];

interface DetectCtx {
  pkgDeps: Set<string>;
  pipDeps: Set<string>;
  textIncludes: (fileMatch: string, needle: string) => boolean;
}

export function analyzeStructure(files: CodeFile[], projectName: string): StructureReport {
  const totals = { files: files.length, bytes: 0, lines: 0, codeLines: 0, commentLines: 0, blankLines: 0 };
  const langAgg = new Map<string, { files: number; lines: number; bytes: number }>();
  const topDirAgg = new Map<string, { files: number; lines: number; bytes: number }>();

  for (const f of files) {
    totals.bytes += f.size;
    totals.lines += f.lines;
    totals.codeLines += f.codeLines;
    totals.commentLines += f.commentLines;
    totals.blankLines += f.blankLines;
    if (f.language) {
      const agg = langAgg.get(f.language) ?? { files: 0, lines: 0, bytes: 0 };
      agg.files += 1;
      agg.lines += f.lines;
      agg.bytes += f.size;
      langAgg.set(f.language, agg);
    }
    const firstSeg = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
    const dirAgg = topDirAgg.get(firstSeg) ?? { files: 0, lines: 0, bytes: 0 };
    dirAgg.files += 1;
    dirAgg.lines += f.lines;
    dirAgg.bytes += f.size;
    topDirAgg.set(firstSeg, dirAgg);
  }

  const totalLines = Math.max(1, totals.lines);
  const languages: LanguageStat[] = [...langAgg.entries()]
    .map(([language, agg]) => ({ language, files: agg.files, lines: agg.lines, bytes: agg.bytes, pct: (agg.lines / totalLines) * 100 }))
    .sort((a, b) => b.lines - a.lines);

  const topDirs = [...topDirAgg.entries()]
    .map(([name, agg]) => ({ name, ...agg }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  // frameworks / types / entry points
  const pkg = readPackageJson(files);
  const pkgDeps = new Set<string>();
  if (pkg) {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg.json?.[section];
      if (deps && typeof deps === 'object') for (const name of Object.keys(deps)) pkgDeps.add(name);
    }
  }
  const pipDeps = new Set<string>();
  for (const f of files) {
    if (/(^|\/)requirements[^/]*\.txt$/i.test(f.path) && f.content) {
      for (const rawLine of f.content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('-')) continue;
        const m = line.match(/^([A-Za-z0-9._-]+)/);
        if (m) pipDeps.add(m[1].toLowerCase());
      }
    }
    if (/(^|\/)pyproject\.toml$/i.test(f.path) && f.content) {
      const depBlock = f.content.match(/dependencies\s*=\s*\[([^\]]*)\]/s);
      if (depBlock) {
        for (const m of depBlock[1].matchAll(/["']([A-Za-z0-9._-]+)/g)) pipDeps.add(m[1].toLowerCase());
      }
    }
  }
  const lowerContents = files.map((f) => ({ path: f.path.toLowerCase(), content: f.content.toLowerCase() }));
  const textIncludes = (fileMatch: string, needle: string) =>
    lowerContents.some((f) => f.path.endsWith(fileMatch) && f.content.includes(needle));

  const frameworks = FRAMEWORK_DETECT.filter((f) => f.test({ pkgDeps, pipDeps, textIncludes })).map((f) => f.name);

  const hasPackageJson = !!pkg;
  const hasRequirements = files.some((f) => /(^|\/)requirements[^/]*\.txt$/i.test(f.path));
  const hasPyproject = files.some((f) => /(^|\/)pyproject\.toml$/i.test(f.path));
  const hasCargo = files.some((f) => /(^|\/)cargo\.toml$/i.test(f.path));
  const hasGoMod = files.some((f) => /(^|\/)go\.mod$/i.test(f.path));
  const hasPom = files.some((f) => /(^|\/)pom\.xml$/i.test(f.path));
  const hasGradle = files.some((f) => /build\.gradle(\.kts)?$/i.test(f.path));
  const hasGemfile = files.some((f) => /(^|\/)gemfile$/i.test(f.path));
  const hasComposer = files.some((f) => /(^|\/)composer\.json$/i.test(f.path));
  const hasDocs = files.some((f) => /\.md$/i.test(f.path));
  const hasDocker = files.some((f) => /(^|\/)dockerfile$/i.test(f.path) || /docker-compose/i.test(f.path));
  const hasCi = files.some((f) => /\.github\/workflows\//i.test(f.path) || /\.gitlab-ci\.yml$/i.test(f.path));
  const hasTests = files.some((f) => /(^|\/)(tests?|__tests__|spec|cypress)\//i.test(f.path) || /\.(test|spec)\.[jt]sx?$/i.test(f.path));

  const projectTypes: string[] = [];
  if (hasPackageJson && frameworks.some((f) => ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt'].includes(f))) projectTypes.push('Frontend Web App');
  if (frameworks.some((f) => ['Express', 'Fastify', 'NestJS', 'Koa', 'Hono'].includes(f))) projectTypes.push('Node.js Backend / API');
  if (hasPackageJson && projectTypes.length === 0) projectTypes.push('Node.js Project');
  if (frameworks.some((f) => ['Flask', 'Django', 'FastAPI'].includes(f))) projectTypes.push('Python Web Service');
  if (hasPyproject || hasRequirements) projectTypes.push('Python Project');
  if (hasCargo) projectTypes.push('Rust Project');
  if (hasGoMod) projectTypes.push('Go Module');
  if (hasPom || hasGradle) projectTypes.push('JVM / Java Project');
  if (hasGemfile) projectTypes.push('Ruby Project');
  if (hasComposer) projectTypes.push('PHP Project');
  if (hasDocker) projectTypes.push('Containerized');
  if (hasCi) projectTypes.push('CI/CD Enabled');
  if (hasTests) projectTypes.push('Has Automated Tests');
  if (hasDocs) projectTypes.push('Documented');
  if (projectTypes.length === 0) projectTypes.push('General Codebase');

  const entryPoints: string[] = [];
  const pkgMain = typeof pkg?.json?.main === 'string' && pkg.json.main ? String(pkg.json.main) : null;
  if (pkgMain) entryPoints.push(`package.json → ${pkgMain}`);
  const ENTRY_CANDIDATES = [
    'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
    'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js',
    'src/server.ts', 'src/server.js', 'src/app.ts', 'src/app.js',
    'index.js', 'index.ts', 'server.js', 'app.js', 'main.py', 'app.py', 'manage.py', 'main.go',
  ];
  const fileSet = new Set(files.map((f) => f.path));
  for (const candidate of ENTRY_CANDIDATES) {
    if (candidate === pkgMain) continue;
    if (fileSet.has(candidate)) entryPoints.push(candidate);
    if (entryPoints.length >= 6) break;
  }
  for (const f of files) {
    if (entryPoints.length >= 8) break;
    if (/\.github\/workflows\/[^/]+\.ya?ml$/i.test(f.path)) entryPoints.push(`CI: ${f.path}`);
  }

  const scripts: { name: string; command: string }[] = [];
  if (pkg?.json?.scripts && typeof pkg.json.scripts === 'object') {
    for (const [name, command] of Object.entries(pkg.json.scripts as Record<string, string>)) {
      scripts.push({ name, command: String(command) });
    }
  }

  const tree = buildTree(files, projectName);

  return { totals, languages, tree, topDirs, frameworks, projectTypes, entryPoints, scripts: scripts.slice(0, 30) };
}
