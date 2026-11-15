import type { WorkspaceTab } from '../lib/types';
import {
  IconOverview, IconTree, IconDiagram, IconPackage, IconApi, IconShield, IconDocs, IconSettings, IconZap,
} from './icons';

interface SidebarProps {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  counts: Partial<Record<WorkspaceTab, number>>;
  alerts: Partial<Record<WorkspaceTab, boolean>>;
  projectName: string;
}

const NAV: { id: WorkspaceTab; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'structure', label: 'Structure', icon: IconTree },
  { id: 'diagrams', label: 'Diagrams', icon: IconDiagram },
  { id: 'dependencies', label: 'Dependencies', icon: IconPackage },
  { id: 'api', label: 'API Map', icon: IconApi },
  { id: 'security', label: 'Security', icon: IconShield },
  { id: 'docs', label: 'Dev Docs', icon: IconDocs },
  { id: 'settings', label: 'AI Engine', icon: IconSettings },
];

export default function Sidebar({ active, onChange, counts, alerts, projectName }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Analysis sections">
      <div className="side-label">Analysis deck</div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const count = counts[item.id];
        const alert = alerts[item.id];
        return (
          <button
            key={item.id}
            className={`nav-item${active === item.id ? ' active' : ''}`}
            onClick={() => onChange(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
            title={item.label}
          >
            <Icon size={17} />
            <span className="nav-label">{item.label}</span>
            {count !== undefined && (
              <span className={`nav-badge${alert ? ' alert' : ''}`}>{count > 999 ? '999+' : count}</span>
            )}
          </button>
        );
      })}
      <div className="side-footer">
        <div style={{ color: 'var(--green)', letterSpacing: '0.18em', marginBottom: 4 }}>BLACKBOX v1.0</div>
        TARGET: <span style={{ color: 'var(--text)' }}>{projectName}</span><br />
        MODE: STATIC / OFFLINE<br />
        SANDBOX: BROWSER LOCAL
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--muted)' }}>
          <IconZap size={11} /> NO CODE LEAVES THIS PAGE
        </div>
      </div>
    </aside>
  );
}
