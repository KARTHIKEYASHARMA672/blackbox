import { useMemo, useState } from 'react';
import type { AnalysisResult, WorkspaceTab } from '../../lib/types';
import { PanelHead, EmptyState, MethodPill } from '../ui';
import { IconApi, IconSearch, IconArrowRight } from '../icons';

interface Props {
  analysis: AnalysisResult;
  onNavigate: (tab: WorkspaceTab) => void;
}

type View = 'routes' | 'calls';

export default function ApiMapPanel({ analysis, onNavigate }: Props) {
  const [view, setView] = useState<View>('routes');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'internal' | 'external'>('all');

  const q = query.trim().toLowerCase();

  const routes = useMemo(
    () => analysis.routes.filter((r) => !q || r.path.toLowerCase().includes(q) || r.framework.toLowerCase().includes(q) || r.file.toLowerCase().includes(q)),
    [analysis.routes, q],
  );

  const calls = useMemo(
    () => analysis.calls.filter((c) => {
      if (scope === 'internal' && c.external) return false;
      if (scope === 'external' && !c.external) return false;
      if (q && !c.url.toLowerCase().includes(q) && !c.client.toLowerCase().includes(q) && !c.file.toLowerCase().includes(q)) return false;
      return true;
    }),
    [analysis.calls, q, scope],
  );

  const matched = analysis.calls.filter((c) => c.matchedRoute).length;
  const external = analysis.calls.filter((c) => c.external).length;

  return (
    <div className="panel">
      <PanelHead
        index="05"
        title="API Map"
        sub="Server-side routes and client-side HTTP calls, statically linked — the contract layer of the codebase."
        actions={
          <button className="btn" onClick={() => onNavigate('diagrams')}>
            Flow diagram <IconArrowRight size={13} />
          </button>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-num">{analysis.routes.length}</div><div className="stat-lbl">Server routes</div></div>
        <div className="stat-card"><div className="stat-num">{analysis.calls.length}</div><div className="stat-lbl">Client calls</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--green)' }}>{matched}</div><div className="stat-lbl">Calls linked to routes</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--amber)' }}>{external}</div><div className="stat-lbl">External endpoints</div></div>
      </div>

      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="API view">
          <button role="tab" aria-selected={view === 'routes'} className={view === 'routes' ? 'active' : ''} onClick={() => setView('routes')}>ROUTES ({routes.length})</button>
          <button role="tab" aria-selected={view === 'calls'} className={view === 'calls' ? 'active' : ''} onClick={() => setView('calls')}>CLIENT CALLS ({calls.length})</button>
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
          <input className="input search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder={view === 'routes' ? 'Filter routes, frameworks, files…' : 'Filter URLs, clients, files…'} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter API entries" />
        </div>
        {view === 'calls' && (
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label="Filter by scope">
            <option value="all">All scopes</option>
            <option value="internal">Internal only</option>
            <option value="external">External only</option>
          </select>
        )}
      </div>

      {view === 'routes' && (
        routes.length === 0 ? (
          <EmptyState title="No routes detected" hint="BLACKBOX understands Express/Fastify/Koa/Hono handlers (app.get…), NestJS decorators, Next.js pages/api & app router, Flask/FastAPI route decorators, Django path(), Spring @…Mapping, Go net/http/Gin/Echo/Fiber, Rails/Sinatra and Actix/Axum." icon={<IconApi size={40} strokeWidth={1.2} />} />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Method</th><th>Path</th><th>Framework</th><th>Location</th></tr></thead>
              <tbody>
                {routes.map((r, i) => (
                  <tr key={`${r.file}:${r.line}:${i}`}>
                    <td><MethodPill method={r.method} /></td>
                    <td className="mono" style={{ color: 'var(--text-strong)' }}>{r.path}</td>
                    <td className="mono muted">{r.framework}</td>
                    <td className="mono muted" style={{ fontSize: 10.5 }}>{r.file}:{r.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {view === 'calls' && (
        calls.length === 0 ? (
          <EmptyState title="No client HTTP calls detected" hint="Looks for fetch(), axios (.get/.post/…), jQuery $.ajax, requests / httpx / urllib (Python) and net/http (Go). Dynamic URLs built at runtime are out of static reach by design." icon={<IconApi size={40} strokeWidth={1.2} />} />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Method</th><th>URL</th><th>Client</th><th>Scope</th><th>Resolves to</th><th>Location</th></tr></thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={`${c.file}:${c.line}:${i}`}>
                    <td><MethodPill method={c.method} /></td>
                    <td className="mono" style={{ color: 'var(--text-strong)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.url}>{c.url}</td>
                    <td className="mono muted">{c.client}</td>
                    <td>{c.external ? <span className="chip chip-amber">external</span> : <span className="chip chip-cyan">internal</span>}</td>
                    <td className="mono" style={{ fontSize: 10.5, color: c.matchedRoute ? '#9df0c3' : 'var(--muted-2)' }}>{c.matchedRoute ?? '—'}</td>
                    <td className="mono muted" style={{ fontSize: 10.5 }}>{c.file}:{c.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
