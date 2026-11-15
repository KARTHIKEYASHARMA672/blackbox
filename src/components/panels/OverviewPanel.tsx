import type { AnalysisResult, WorkspaceTab } from '../../lib/types';
import { formatBytes } from '../../lib/util';
import { PanelHead, SeverityTag } from '../ui';
import { IconZap, IconArrowRight, IconAlert } from '../icons';

interface Props {
  analysis: AnalysisResult;
  onNavigate: (tab: WorkspaceTab) => void;
}

function RiskGauge({ score, grade, color }: { score: number; grade: string; color: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, score / 100));
  const arc = circumference * fraction;

  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`Security score ${score} out of 100, grade ${grade}`}>
      <circle cx="75" cy="75" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="13" fill="none" />
      <circle
        cx="75" cy="75" r={radius} stroke={color} strokeWidth="13" fill="none" strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference}`}
        transform="rotate(-90 75 75)"
        style={{ filter: `drop-shadow(0 0 12px ${color}88)`, transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="75" y="70" textAnchor="middle" fill="var(--text-strong)" fontSize="33" fontWeight="700" fontFamily="JetBrains Mono, monospace">{score}</text>
      <text x="75" y="92" textAnchor="middle" fill="var(--muted)" fontSize="9.5" fontFamily="JetBrains Mono, monospace" letterSpacing="2">/ 100</text>
    </svg>
  );
}

export default function OverviewPanel({ analysis, onNavigate }: Props) {
  const a = analysis;
  const critical = a.findings.filter((f) => f.severity === 'critical').length;
  const high = a.findings.filter((f) => f.severity === 'high').length;
  const topFindings = a.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 4);
  const maxLangLines = Math.max(1, ...a.languages.map((l) => l.lines));

  return (
    <div className="panel">
      <PanelHead
        index="01"
        title="Overview"
        sub="BLACKBOX verdict on the target — composition, risk posture and where to look next."
        actions={
          <button className="btn btn-primary" onClick={() => onNavigate('docs')}>
            <IconZap size={15} /> Generate AI dossier
          </button>
        }
      />

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{a.totals.files}</div><div className="stat-lbl">Files scanned</div></div>
        <div className="stat-card"><div className="stat-num">{a.totals.codeLines.toLocaleString()}</div><div className="stat-lbl">Lines of code</div></div>
        <div className="stat-card"><div className="stat-num">{formatBytes(a.totals.bytes)}</div><div className="stat-lbl">Total size</div></div>
        <div className="stat-card"><div className="stat-num">{a.routes.length}<small> / {a.calls.length}</small></div><div className="stat-lbl">Routes / HTTP calls</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: a.riskColor }}>{a.findings.length}</div><div className="stat-lbl">Security findings</div></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        {/* risk posture */}
        <div className="card card-pad">
          <h3 className="card-title"><IconAlert size={14} /> Risk posture</h3>
          <div className="gauge-wrap">
            <RiskGauge score={a.score} grade={a.grade} color={a.riskColor} />
            <div>
              <div className="gauge-num" style={{ color: a.riskColor }}>Grade {a.grade}</div>
              <div className="gauge-grade">{a.riskLabel}</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--red)' }}>■ {critical} critical</span>
                <span style={{ color: 'var(--orange)' }}>■ {high} high</span>
                <span style={{ color: 'var(--amber)' }}>■ {a.findings.filter((f) => f.severity === 'medium').length} medium</span>
                <span className="muted">+{a.advisories.length} vulnerable dependencies</span>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('security')}>
                Open security deck <IconArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* project fingerprint */}
        <div className="card card-pad">
          <h3 className="card-title">Project fingerprint</h3>
          <div className="kv"><span className="k">Classification</span><span className="v">{a.projectTypes.join(' · ')}</span></div>
          <div className="kv"><span className="k">Frameworks</span><span className="v">{a.frameworks.length ? a.frameworks.join(' · ') : 'none detected'}</span></div>
          <div className="kv"><span className="k">Entry points</span><span className="v mono" style={{ fontSize: 10.5 }}>{a.entryPoints.slice(0, 3).join(' · ') || '—'}</span></div>
          <div className="kv"><span className="k">Scripts</span><span className="v">{a.scripts.length} detected</span></div>
          <div className="kv"><span className="k">Dependencies</span><span className="v">{a.dependencies.length} total · {a.dependencies.filter((d) => d.type === 'runtime').length} runtime</span></div>
          <div className="kv"><span className="k">Languages</span><span className="v">{a.languages.length}</span></div>
          <div className="kv"><span className="k">Manifest coverage</span><span className="v">{[...new Set(a.dependencies.map((d) => d.manager))].join(' · ') || 'none'}</span></div>
        </div>
      </div>

      <div className="grid-2">
        {/* language composition */}
        <div className="card card-pad">
          <h3 className="card-title">Language composition</h3>
          {a.languages.slice(0, 9).map((l) => (
            <div className="lang-row" key={l.language}>
              <span className="lang-name">{l.language}</span>
              <div className="lang-track"><div className="lang-fill" style={{ width: `${(l.lines / maxLangLines) * 100}%` }} /></div>
              <span className="lang-pct">{l.pct.toFixed(1)}%</span>
            </div>
          ))}
          {a.languages.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No recognized languages.</div>}
        </div>

        {/* critical surface */}
        <div className="card card-pad">
          <h3 className="card-title">Critical surface — act first</h3>
          {topFindings.length === 0 ? (
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
              Nothing critical or high severity detected by the built-in rulepack.<br />
              <span style={{ fontSize: 10.5 }}>Absence of evidence is not evidence of absence — run a dedicated scanner and review auth boundaries manually.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topFindings.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onNavigate('security')}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
                >
                  <SeverityTag severity={f.severity} />
                  <span>
                    <span className="finding-title" style={{ fontSize: 12 }}>{f.title}</span>
                    <span className="finding-loc">{f.file}{f.line ? `:${f.line}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
