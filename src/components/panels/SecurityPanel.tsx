import { useMemo, useState } from 'react';
import type { AnalysisResult, Severity } from '../../lib/types';
import { PanelHead, EmptyState, SeverityTag } from '../ui';
import { IconShield, IconChevronDown, IconChevronRight, IconSearch } from '../icons';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../lib/util';

interface Props {
  analysis: AnalysisResult;
}

type SevFilter = 'all' | Severity;
type SortMode = 'severity' | 'file';

const SEV_COLORS: Record<Severity, string> = {
  critical: '#fb7185', high: '#fb923c', medium: '#fbbf24', low: '#5eead4', info: '#8aa695',
};

export default function SecurityPanel({ analysis }: Props) {
  const [sev, setSev] = useState<SevFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('severity');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of analysis.findings) c[f.severity] += 1;
    return c;
  }, [analysis.findings]);

  const categories = useMemo(() => [...new Set(analysis.findings.map((f) => f.category))].sort(), [analysis.findings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = analysis.findings.filter((f) => {
      if (sev !== 'all' && f.severity !== sev) return false;
      if (category !== 'all' && f.category !== category) return false;
      if (q && !`${f.title} ${f.file} ${f.ruleId} ${f.category} ${f.snippet}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'file') {
      list = [...list].sort((x, y) => x.file.localeCompare(y.file) || x.line - y.line);
    }
    return list;
  }, [analysis.findings, sev, category, query, sort]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filtered.map((f) => f.id)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="panel">
      <PanelHead
        index="06"
        title="Security Assessment"
        sub="Heuristic static rulepack (30 rules) + offline dependency advisories. Findings are leads, not verdicts — verify before acting."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="seg" role="group" aria-label="Sort findings">
              <button className={sort === 'severity' ? 'active' : ''} onClick={() => setSort('severity')}>BY SEVERITY</button>
              <button className={sort === 'file' ? 'active' : ''} onClick={() => setSort('file')}>BY FILE</button>
            </div>
            <button className="btn btn-sm" onClick={expanded.size ? collapseAll : expandAll}>{expanded.size ? 'Collapse all' : 'Expand all'}</button>
          </div>
        }
      />

      {/* severity summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`chip${sev === 'all' ? ' chip-green' : ''}`} onClick={() => setSev('all')} style={{ cursor: 'pointer' }}>
          ALL <b>{analysis.findings.length}</b>
        </button>
        {SEVERITY_ORDER.map((s) => (
          <button
            key={s}
            className="chip"
            onClick={() => setSev(sev === s ? 'all' : s)}
            style={{ cursor: 'pointer', borderColor: sev === s ? SEV_COLORS[s] : undefined, color: sev === s ? SEV_COLORS[s] : undefined, boxShadow: sev === s ? `0 0 12px ${SEV_COLORS[s]}44` : undefined }}
            aria-pressed={sev === s}
          >
            <span style={{ color: SEV_COLORS[s] }}>●</span> {SEVERITY_LABEL[s].toUpperCase()} <b>{counts[s]}</b>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
          <input className="input search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Search findings, files, rules…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search findings" />
        </div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="muted mono" style={{ fontSize: 11 }}>{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={analysis.findings.length === 0 ? 'Zero findings — suspiciously clean' : 'No findings match your filters'}
          hint={analysis.findings.length === 0 ? 'The rulepack found nothing. Static heuristics are not a pentest — review auth, access control and data flows manually, and run a real scanner (Semgrep, CodeQL, gitleaks).' : 'Clear the severity/category filter or search term.'}
          icon={<IconShield size={40} strokeWidth={1.2} />}
        />
      ) : (
        <div>
          {filtered.map((f) => {
            const isOpen = expanded.has(f.id);
            return (
              <div className={`finding sev-border-${f.severity}`} key={f.id}>
                <button className="finding-head" onClick={() => toggle(f.id)} aria-expanded={isOpen}>
                  <SeverityTag severity={f.severity} />
                  <span style={{ minWidth: 0 }}>
                    <span className="finding-title">{f.title}</span>
                    <span className="finding-loc">[{f.ruleId}] {f.file}{f.line ? `:${f.line}` : ''} · {f.category}</span>
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{isOpen ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}</span>
                </button>
                {isOpen && (
                  <div className="finding-body">
                    <div style={{ marginBottom: 6 }}>{f.description}</div>
                    {f.snippet && f.line > 0 && <pre className="code-snippet">{f.line} │ {f.snippet}</pre>}
                    <div className="fix"><strong>Remediation:</strong> {f.remediation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="note-box" style={{ marginTop: 14 }}>
        <strong>Scope &amp; honesty:</strong> this is a pattern-matching scan, not a SAST platform. It cannot see business-logic flaws, authz gaps, race conditions or runtime misconfig. Treat BLACKBOX as the fast first pass — then run <span className="mono" style={{ color: 'var(--cyan)' }}>semgrep</span>, <span className="mono" style={{ color: 'var(--cyan)' }}>gitleaks</span>, <span className="mono" style={{ color: 'var(--cyan)' }}>npm audit</span> and a human review.
      </div>
    </div>
  );
}
