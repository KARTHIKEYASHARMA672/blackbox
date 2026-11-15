import type { ApiCall, ApiRoute, CodeFile } from './types';
import { escapeRegExp } from './util';

const MAX_ROUTES = 500;
const MAX_CALLS = 500;

function normalizeRoutePath(p: string): string {
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\/{2,}/g, '/');
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function jsFrameworkHint(content: string): string {
  if (/from\s+['"]fastify['"]/.test(content) || /require\(['"]fastify['"]\)/.test(content)) return 'Fastify';
  if (/from\s+['"]hono['"]/.test(content) || /@hono/.test(content)) return 'Hono';
  if (/from\s+['"]koa['"]/.test(content)) return 'Koa';
  if (/@nestjs/.test(content)) return 'NestJS';
  return 'Express';
}

function pyFrameworkHint(content: string): string {
  if (/fastapi/i.test(content)) return 'FastAPI';
  if (/flask/i.test(content)) return 'Flask';
  if (/django/i.test(content)) return 'Django';
  return 'Flask/FastAPI';
}

function nextApiRoutePath(path: string): string | null {
  // pages/api/foo/bar.ts  -> /api/foo/bar
  const pages = path.match(/(?:^|\/)pages\/api\/(.+)\.(ts|tsx|js|jsx|mjs)$/);
  if (pages) {
    const rest = pages[1].replace(/\/index$/, '').replace(/\[\.\.\.([^\]]+)\]/g, ':$1*').replace(/\[([^\]]+)\]/g, ':$1');
    return normalizeRoutePath(`/api/${rest}`);
  }
  // app/foo/bar/route.ts -> /foo/bar   (strip leading "api" groups and route groups)
  const app = path.match(/(?:^|\/)app\/(.+)\/route\.(ts|tsx|js|jsx)$/);
  if (app) {
    const rest = app[1]
      .split('/')
      .filter((seg) => !/^(\([^)]*\)|@[^/]+)$/.test(seg))
      .map((seg) => seg.replace(/^\[\.\.\.(.+)\]$/, ':$1*').replace(/^\[(.+)\]$/, ':$1'))
      .join('/');
    return normalizeRoutePath(`/${rest}`);
  }
  return null;
}

function buildLineOffsets(content: string): number[] {
  const offsets = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  return offsets;
}

function lineAt(offsets: number[], index: number): number {
  let lo = 0, hi = offsets.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= index) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans + 1;
}

function extractRoutes(files: CodeFile[]): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const seen = new Set<string>();
  const add = (method: string, path: string, framework: string, file: string, line: number) => {
    if (routes.length >= MAX_ROUTES) return;
    const normalized = normalizeRoutePath(path);
    const key = `${method} ${normalized} ${file}`;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push({ method: method.toUpperCase(), path: normalized, framework, file, line });
  };

  for (const f of files) {
    const pathLower = f.path.toLowerCase();
    const lineOffsets = buildLineOffsets(f.content);
    const isJsLike = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(pathLower);
    const isPy = /\.py$/.test(pathLower);
    const isJava = /\.(java|kt)$/.test(pathLower);
    const isGo = /\.go$/.test(pathLower);
    const isRuby = /\.rb$/.test(pathLower);
    const isRust = /\.rs$/.test(pathLower);

    // Next.js file-based API routes
    const nextPath = nextApiRoutePath(pathLower);
    if (nextPath) {
      const methods = [...f.content.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map((m) => m[1]);
      if (methods.length === 0) methods.push('ANY');
      for (const method of new Set(methods)) add(method, nextPath, 'Next.js', f.path, 1);
      continue;
    }

    if (isJsLike) {
      const hint = jsFrameworkHint(f.content);
      // Express / Fastify / Koa / Hono style: app.get('/path', ...)
      for (const m of f.content.matchAll(/\b(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi)) {
        add(m[1] === 'all' ? 'ANY' : m[1], m[2], hint, f.path, lineAt(lineOffsets, m.index ?? 0));
      }
      // NestJS: @Controller('users') + @Get(':id')
      const controller = f.content.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/);
      const prefix = controller ? `/${controller[1].replace(/^\/+|\/+$/g, '')}` : '';
      for (const m of f.content.matchAll(/@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g)) {
        const decoratorMethod = m[1].toLowerCase() === 'all' ? 'ANY' : m[1].toLowerCase();
        const sub = m[2] ? `/${m[2].replace(/^\/+/, '')}` : '';
        add(decoratorMethod, `${prefix}${sub || '/'}`, 'NestJS', f.path, lineAt(lineOffsets, m.index ?? 0));
      }
    }

    if (isPy) {
      const hint = pyFrameworkHint(f.content);
      // Flask / FastAPI: @app.route('/x', methods=['GET','POST']) or @app.get('/x')
      for (const m of f.content.matchAll(/@(\w+)\.(?:route|get|post|put|patch|delete|options|head)\s*\(\s*['"]([^'"]+)['"]([^)\n]*)\)/g)) {
        const decorator = m[0].match(/\.(route|get|post|put|patch|delete|options|head)\b/)?.[1] ?? 'route';
        const methodsMatch = m[3]?.match(/methods\s*=\s*\[([^\]]*)\]/);
        if (decorator === 'route' && methodsMatch) {
          for (const mm of methodsMatch[1].matchAll(/['"]([A-Z]+)['"]/g)) {
            add(mm[1], m[2], hint, f.path, lineAt(lineOffsets, m.index ?? 0));
          }
        } else if (decorator === 'route') {
          add('GET', m[2], hint, f.path, lineAt(lineOffsets, m.index ?? 0));
        } else {
          add(decorator, m[2], hint, f.path, lineAt(lineOffsets, m.index ?? 0));
        }
      }
      // Django: path('users/', view) / re_path(...)
      if (pathLower.endsWith('urls.py')) {
        for (const m of f.content.matchAll(/\b(?:path|re_path)\s*\(\s*['"]([^'"]+)['"]/g)) {
          add('ANY', `/${m[1].replace(/^\/+/, '')}`, 'Django', f.path, lineAt(lineOffsets, m.index ?? 0));
        }
      }
    }

    if (isJava) {
      if (/spring|web\/servlet/i.test(f.content) || /@(?:Get|Post|Put|Patch|Delete|Request)Mapping/.test(f.content)) {
        const classLevel = f.content.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)\s*(?:@\w+\s*)?(?:public\s+)?(?:class|interface)/);
        const prefix = classLevel ? `/${classLevel[1].replace(/^\/+|\/+$/g, '')}` : '';
        for (const m of f.content.matchAll(/@(Get|Post|Put|Patch|Delete|Request)Mapping\s*(?:\(\s*(?:value\s*=\s*)?["']([^"']*)["'])?/g)) {
          const kind = m[1].toLowerCase();
          const sub = m[2] ? `/${m[2].replace(/^\/+/, '')}` : '';
          add(kind === 'request' ? 'ANY' : kind, `${prefix}${sub || '/'}`, 'Spring', f.path, lineAt(lineOffsets, m.index ?? 0));
        }
      }
    }

    if (isGo) {
      const hint = /gin-gonic/.test(f.content) ? 'Gin' : /labstack\/echo/.test(f.content) ? 'Echo' : /gofiber/.test(f.content) ? 'Fiber' : 'Net/http';
      for (const m of f.content.matchAll(/\.\s*(GET|POST|PUT|PATCH|DELETE|ANY|HandleFunc)\s*\(\s*["']([^"']+)["']/g)) {
        const kind = m[1].toUpperCase();
        add(kind === 'HANDLEFUNC' || kind === 'ANY' ? 'ANY' : kind, m[2], hint, f.path, lineAt(lineOffsets, m.index ?? 0));
      }
      for (const m of f.content.matchAll(/http\.Handle\s*\(\s*["']([^"']+)["']/g)) {
        add('ANY', m[1], 'Net/http', f.path, lineAt(lineOffsets, m.index ?? 0));
      }
    }

    if (isRuby) {
      if (/routes\.rb$/.test(pathLower) || /sinatra/i.test(f.content)) {
        for (const m of f.content.matchAll(/^\s*(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gim)) {
          add(m[1], `/${m[2].replace(/^\/+/, '')}`, /rails/i.test(f.content) ? 'Rails' : 'Sinatra', f.path, lineAt(lineOffsets, m.index ?? 0));
        }
      }
    }

    if (isRust) {
      for (const m of f.content.matchAll(/#\[(get|post|put|patch|delete)\s*\(\s*"([^"]+)"\s*\)\]/g)) {
        add(m[1], m[2], 'Actix-web', f.path, lineAt(lineOffsets, m.index ?? 0));
      }
      for (const m of f.content.matchAll(/\.route\s*\(\s*"([^"]+)"/g)) {
        add('ANY', m[1], 'Axum/Actix', f.path, lineAt(lineOffsets, m.index ?? 0));
      }
    }
  }
  return routes;
}

function extractCalls(files: CodeFile[], routes: ApiRoute[]): ApiCall[] {
  const calls: ApiCall[] = [];
  const seen = new Set<string>();

  const matchRoute = (callUrl: string): string | null => {
    let callPath: string;
    try {
      callPath = /^https?:\/\//.test(callUrl) ? new URL(callUrl).pathname : callUrl.split('?')[0];
    } catch {
      callPath = callUrl.split('?')[0];
    }
    callPath = callPath.split('#')[0].replace(/\/{2,}/g, '/');
    if (callPath.length > 1 && callPath.endsWith('/')) callPath = callPath.slice(0, -1);
    if (!callPath.startsWith('/')) callPath = `/${callPath}`;

    for (const route of routes) {
      if (route.path === callPath) return route.path;
    }
    for (const route of routes) {
      const pattern = escapeRegExp(route.path).replace(/:[^/]+\*/g, '.*').replace(/:[^/]+/g, '[^/]+');
      if (new RegExp(`^${pattern}/?$`).test(callPath)) return route.path;
    }
    // prefix match for proxied prefixes like /api -> route /api/x with mount points
    for (const route of routes) {
      if (route.path !== '/' && callPath.startsWith(`${route.path}/`)) return route.path;
    }
    return null;
  };

  const add = (method: string, url: string, client: string, file: string, index: number, lineOffsets: number[]) => {
    if (calls.length >= MAX_CALLS) return;
    const trimmed = url.trim();
    if (!trimmed || trimmed.includes('${') || trimmed.includes('{{') || trimmed.length > 300) return;
    const key = `${file}:${index}:${method}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    const external = /^https?:\/\//.test(trimmed);
    calls.push({ method: method.toUpperCase(), url: trimmed, client, file, line: lineAt(lineOffsets, index), external, matchedRoute: external ? null : matchRoute(trimmed) });
  };

  for (const f of files) {
    const pathLower = f.path.toLowerCase();
    const lineOffsets = buildLineOffsets(f.content);
    const isJsLike = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/.test(pathLower);
    const isPy = /\.py$/.test(pathLower);
    const isGo = /\.go$/.test(pathLower);

    if (isJsLike) {
      // fetch("/url", { method: 'POST' })
      for (const m of f.content.matchAll(/\bfetch\s*\(\s*(`?)(['"`])([^'"`]+)\2/g)) {
        const after = f.content.slice(m.index ?? 0, (m.index ?? 0) + 400);
        const methodMatch = after.match(/method\s*:\s*['"]([A-Za-z]+)['"]/);
        add(methodMatch ? methodMatch[1] : 'GET', m[3], 'fetch', f.path, m.index ?? 0, lineOffsets);
      }
      // axios.get("url") / axios.post(...)
      for (const m of f.content.matchAll(/\baxios\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*[`'"]([^`'"\s,)]+)/gi)) {
        add(m[1], m[2], 'axios', f.path, m.index ?? 0, lineOffsets);
      }
      // axios({ url: "...", method: "..." })
      for (const m of f.content.matchAll(/\baxios\s*\(\s*\{[^}]{0,600}?url\s*:\s*[`'"]([^`'"]+)[`'"]/gs)) {
        const block = m[0];
        const methodMatch = block.match(/method\s*:\s*['"]([A-Za-z]+)['"]/i);
        add(methodMatch ? methodMatch[1] : 'GET', m[1], 'axios', f.path, m.index ?? 0, lineOffsets);
      }
      // $.ajax / $.get / $.post
      for (const m of f.content.matchAll(/\$\s*\.\s*(get|post|ajax|put|delete)\s*\(\s*[`'"]([^`'"\s,)]+)/gi)) {
        add(m[1] === 'ajax' ? 'GET' : m[1], m[2], 'jQuery', f.path, m.index ?? 0, lineOffsets);
      }
      // got / undici / request("url") style
      for (const m of f.content.matchAll(/\b(?:got|undici\.request|request)\s*\(\s*[`'"]([^`'"\s,)]+)/gi)) {
        add('GET', m[1], 'http-client', f.path, m.index ?? 0, lineOffsets);
      }
      // custom axios instances: const api = axios.create({ baseURL: ... }) → api.get('/x')
      const instanceNames = new Set<string>();
      for (const m of f.content.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*axios\.create\b/g)) {
        instanceNames.add(m[1]);
      }
      for (const instance of instanceNames) {
        const rx = new RegExp(`\\b${instance}\\s*\\.\\s*(get|post|put|patch|delete|head|options)\\s*\\(\\s*[\`'"]([^\`'"\\s,)]+)`, 'gi');
        for (const m of f.content.matchAll(rx)) {
          add(m[1], m[2], `axios:${instance}`, f.path, m.index ?? 0, lineOffsets);
        }
      }
    }

    if (isPy) {
      for (const m of f.content.matchAll(/\brequests\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*f?['"]([^'"]+)['"]/gi)) {
        add(m[1], m[2], 'requests', f.path, m.index ?? 0, lineOffsets);
      }
      for (const m of f.content.matchAll(/\b(?:httpx|aiohttp_session|session)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*f?['"]([^'"]+)['"]/gi)) {
        add(m[1], m[2], 'httpx/aiohttp', f.path, m.index ?? 0, lineOffsets);
      }
      for (const m of f.content.matchAll(/\burllib\.request\.urlopen\s*\(\s*f?['"]([^'"]+)['"]/g)) {
        add('GET', m[1], 'urllib', f.path, m.index ?? 0, lineOffsets);
      }
    }

    if (isGo) {
      for (const m of f.content.matchAll(/http\.NewRequest\s*\(\s*["']([A-Za-z]+)["']\s*,\s*["']([^"']+)["']/g)) {
        add(m[1], m[2], 'net/http', f.path, m.index ?? 0, lineOffsets);
      }
      for (const m of f.content.matchAll(/http\.(Get|Post|Head)\s*\(\s*["']([^"']+)["']/g)) {
        add(m[1], m[2], 'net/http', f.path, m.index ?? 0, lineOffsets);
      }
    }
  }

  return calls;
}

export function extractApiMap(files: CodeFile[]): { routes: ApiRoute[]; calls: ApiCall[] } {
  const routes = extractRoutes(files);
  const calls = extractCalls(files, routes);
  return { routes, calls };
}
