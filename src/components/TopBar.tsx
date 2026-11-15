import Logo from './Logo';
import { IconDownload, IconRefresh } from './icons';
import type { AnalysisResult } from '../lib/types';
import { formatBytes } from '../lib/util';

interface TopBarProps {
  analysis: AnalysisResult;
  onExport: () => void;
  onNewScan: () => void;
}

export default function TopBar({ analysis, onExport, onNewScan }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={30} />
          <span className="brand-name" style={{ fontSize: 15 }}>BLACK<em>BOX</em></span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="project-chip" title={analysis.projectName}>
          <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 13 }}>▸</span>
          <span className="name">{analysis.projectName}</span>
        </div>
        <span className="stat-pill"><b>{analysis.totals.files}</b> files</span>
        <span className="stat-pill"><b>{analysis.totals.codeLines.toLocaleString()}</b> LOC</span>
        <span className="stat-pill"><b>{formatBytes(analysis.totals.bytes)}</b></span>
        <span className="stat-pill"><b>{analysis.durationMs}ms</b> scan</span>
      </div>

      <div className="topbar-right">
        <div
          className="grade-badge"
          style={{ color: analysis.riskColor }}
          title={`Security grade ${analysis.grade} — ${analysis.riskLabel} (${analysis.score}/100)`}
        >
          {analysis.grade}
        </div>
        <button className="btn btn-primary" onClick={onExport} title="Download the full report as Markdown">
          <IconDownload size={15} /> Export report
        </button>
        <button className="btn" onClick={onNewScan} title="Run a new scan on another codebase">
          <IconRefresh size={15} /> New scan
        </button>
      </div>
    </header>
  );
}
