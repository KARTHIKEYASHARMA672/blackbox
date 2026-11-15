import type { ReactNode } from 'react';
import type { Severity } from '../lib/types';
import { SEVERITY_LABEL } from '../lib/util';

export function SeverityTag({ severity }: { severity: Severity }) {
  return <span className={`sev sev-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function MethodPill({ method }: { method: string }) {
  const m = method.toUpperCase();
  const known = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const cls = known.includes(m) ? m : 'ANY';
  return <span className={`method method-${cls}`}>{m}</span>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      {icon && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.6 }}>{icon}</div>}
      <div style={{ fontSize: 15, color: 'var(--text-strong)', fontWeight: 600 }}>{title}</div>
      {hint && <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, maxWidth: '52ch', marginInline: 'auto' }}>{hint}</div>}
    </div>
  );
}

export function PanelHead({ index, title, sub, actions }: { index: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="panel-head">
      <div>
        <h2 className="panel-title"><span className="idx">{index}</span>{title}</h2>
        {sub && <p className="panel-sub">{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function severityCount(findings: { severity: Severity }[], sev: Severity): number {
  return findings.reduce((n, f) => n + (f.severity === sev ? 1 : 0), 0);
}
