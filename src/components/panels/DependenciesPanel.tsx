import { useMemo, useState } from 'react';
import type { AnalysisResult, Dependency } from '../../lib/types';
import { PanelHead, EmptyState, SeverityTag } from '../ui';
import { IconPackage, IconSearch, IconAlert } from '../icons';

const MANAGER_LABEL: Record<string, string> = {
  npm: 'npm', pip: 'PyPI', cargo: 'Cargo', gomod: 'Go', maven: 'Maven', gradle: 'Gradle',
  bundler: 'Bundler', composer: 'Composer', nuget: 'NuGet',
};

type TypeFilter = 'all' | 'runtime' | 'dev' | 'peer';

export default function DependenciesPanel({ analysis }: { analysis: AnalysisResult }) {
  const [query, setQuery] = useState('');
  const [manager, setManager] = useState<string>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const managers = useMemo(() => [...new Set(analysis.dependencies.map((d) => d.manager))].sort(), [analysis.dependencies]);
  const flaggedNames = useMemo(() => new Set(analysis.advisories.map((a) => `${a.manager}:${a.name.toLowerCase()}`)), [analysis.advisories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysis.dependencies.filter((d) => {
      if (manager !== 'all' && d.manager !== manager) return false;
      if (type !== 'all' && d.type !== type) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (flaggedOnly && !flaggedNames.has(`${d.manager}:${d.name.toLowerCase()}`)) return false;
      return true;
    });
  }, [analysis.dependencies, query, manager, type, flaggedOnly, flaggedNames]);

  const runtime = analysis.dependencies.filter((d) => d.type === 'runtime').length;
  const dev = analysis.dependencies.filter((d) => d.type === 'dev').length;
  const peer = analysis.dependencies.filter((d) => d.type === 'peer').length;

  const advisoryByName = useMemo(() => {
    const map = new Map<string, typeof analysis.advisories>();
    for (const adv of analysis.advisories) {
      const key = `${adv.manager}:${adv.name.toLowerCase()}`;
      const list = map.get(key) ?? [];
      list.push(adv);
      map.set(key, list);
    }
    return map;
  }, [analysis.advisories]);

  const typeBadge = (d: Dependency) => (
    <span className={`chip ${d.type === 'runtime' ? 'chip-green' : d.type === 'dev' ? '' : 'chip-cyan'}`} style={{ textTransform: 'none', fontSize: 10 }}>{d.type}</span>
  );

  return (
    <div className="panel">
      <PanelHead
        index="04"
        title="Dependencies"
        sub="Every manifest in the repo, parsed and cross-checked against BLACKBOX's offline advisory database."
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-num">{analysis.dependencies.length}</div><div className="stat-lbl">Total resolved</div></div>
        <div className="stat-card"><div className="stat-num">{runtime}<small> / {dev} / {peer}</small></div><div className="stat-lbl">Runtime / Dev / Peer</div></div>
        <div className="stat-card"><div className="stat-num">{managers.length}</div><div className="stat-lbl">Managers</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: analysis.advisories.length ? 'var(--red)' : 'var(--green)' }}>{analysis.advisories.length}</div><div className="stat-lbl">Advisory hits</div></div>
      </div>

      {analysis.advisories.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'rgba(251,113,133,0.35)' }}>
          <h3 className="card-title" style={{ color: '#ffb3be' }}><IconAlert size={14} /> Advisory hits — verify &amp; upgrade</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysis.advisories.map((adv, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid rgba(74,255,168,0.08)', paddingBottom: 8 }}>
                <SeverityTag severity={adv.severity} />
                <div style={{ fontSize: 12 }}>
                  <span className="mono" style={{ color: 'var(--text-strong)' }}>{adv.name}@{adv.version}</span>
                  <span className="muted"> ({MANAGER_LABEL[adv.manager] ?? adv.manager})</span>
                  <div style={{ color: 'var(--text)' }}>{adv.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: '#9df0c3', marginTop: 2 }}>→ {adv.fix}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="muted mono" style={{ fontSize: 9.5, marginTop: 10 }}>Offline heuristic database — confirm with <code style={{ color: 'var(--cyan)' }}>npm audit</code> / <code style={{ color: 'var(--cyan)' }}>pip-audit</code> / GitHub Advisory Database before acting.</div>
        </div>
      )}

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
          <input className="input search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Filter packages…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter dependencies" />
        </div>
        <select className="input" value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Filter by manager">
          <option value="all">All managers</option>
          {managers.map((m) => <option key={m} value={m}>{MANAGER_LABEL[m] ?? m}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Filter by type">
          <option value="all">All types</option>
          <option value="runtime">runtime</option>
          <option value="dev">dev</option>
          <option value="peer">peer</option>
        </select>
        <button className={`btn btn-sm${flaggedOnly ? ' btn-primary' : ''}`} onClick={() => setFlaggedOnly((v) => !v)} aria-pressed={flaggedOnly}>
          Flagged only
        </button>
        <span className="muted mono" style={{ fontSize: 11 }}>{filtered.length} / {analysis.dependencies.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={analysis.dependencies.length === 0 ? 'No dependency manifests found' : 'No packages match your filter'}
          hint={analysis.dependencies.length === 0 ? 'BLACKBOX reads package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, pom.xml, build.gradle, Gemfile, composer.json and *.csproj.' : 'Try clearing the search or type filter.'}
          icon={<IconPackage size={40} strokeWidth={1.2} />}
        />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Package</th><th>Version</th><th>Type</th><th>Manager</th><th>Manifest</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const hits = advisoryByName.get(`${d.manager}:${d.name.toLowerCase()}`) ?? [];
                return (
                  <tr key={`${d.manifest}:${d.name}:${i}`}>
                    <td className="mono" style={{ color: 'var(--text-strong)' }}>{d.name}</td>
                    <td className="mono">{d.version}</td>
                    <td>{typeBadge(d)}</td>
                    <td className="mono muted">{MANAGER_LABEL[d.manager] ?? d.manager}</td>
                    <td className="mono muted" style={{ fontSize: 10 }}>{d.manifest}</td>
                    <td>{hits.length ? <span className="sev sev-high">Flagged ×{hits.length}</span> : <span className="muted" style={{ fontSize: 11 }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
