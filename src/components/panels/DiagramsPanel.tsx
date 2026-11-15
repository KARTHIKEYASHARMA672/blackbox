import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import type { AnalysisResult } from '../../lib/types';
import { copyToClipboard, downloadText } from '../../lib/util';
import { PanelHead, EmptyState } from '../ui';
import { IconCopy, IconDownload, IconDiagram, IconCheck } from '../icons';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    background: '#0d1510',
    primaryColor: '#0e1611',
    primaryTextColor: '#b8ffd9',
    primaryBorderColor: '#34f5a5',
    lineColor: '#3f7d5a',
    secondaryColor: '#101b14',
    tertiaryColor: '#14231a',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    pie1: '#34f5a5', pie2: '#5eead4', pie3: '#fbbf24', pie4: '#fb923c', pie5: '#fb7185',
    pie6: '#a78bfa', pie7: '#7dd3fc', pie8: '#86efac',
    pieTextColor: '#d9f7e6',
    pieStrokeColor: '#060a08',
    pieOuterStrokeColor: '#060a08',
    pieTitleTextSize: '14px',
  },
  flowchart: { curve: 'basis', padding: 12 },
  securityLevel: 'strict',
});

export default function DiagramsPanel({ analysis }: { analysis: AnalysisResult }) {
  const [active, setActive] = useState(analysis.diagrams[0]?.id ?? null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const diagram = useMemo(
    () => analysis.diagrams.find((d) => d.id === active) ?? analysis.diagrams[0] ?? null,
    [analysis.diagrams, active],
  );

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!diagram) return;
      setLoading(true);
      setError(null);
      try {
        const id = `bb_${diagram.id}_${Date.now().toString(36)}`;
        const { svg: rendered } = await mermaid.render(id, diagram.mermaid);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          setSvg('');
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [diagram]);

  if (analysis.diagrams.length === 0) {
    return (
      <div className="panel">
        <PanelHead index="03" title="Architecture Diagrams" sub="Mermaid diagrams synthesized from the codebase." />
        <EmptyState title="No diagrams could be synthesized" hint="The analysis found nothing to visualize." icon={<IconDiagram size={40} strokeWidth={1.2} />} />
      </div>
    );
  }

  return (
    <div className="panel">
      <PanelHead
        index="03"
        title="Architecture Diagrams"
        sub="Synthesized from static analysis — import graph, call→route linkage, stack topology and language mix."
        actions={
          <>
            <button className="btn btn-sm" onClick={async () => { if (diagram && await copyToClipboard(diagram.mermaid)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} Copy Mermaid source
            </button>
            <button className="btn btn-sm" onClick={() => diagram && downloadText(`${analysis.projectName}_${diagram.id}.mmd`, diagram.mermaid, 'text/plain')}>
              <IconDownload size={13} /> .mmd
            </button>
          </>
        }
      />

      <div className="diagram-tabs" role="tablist" aria-label="Diagram views">
        {analysis.diagrams.map((d) => (
          <button key={d.id} role="tab" aria-selected={d.id === diagram?.id} className={`diagram-tab${d.id === diagram?.id ? ' active' : ''}`} onClick={() => setActive(d.id)}>
            {d.title}
          </button>
        ))}
      </div>

      {diagram && <p className="muted" style={{ fontSize: 12, margin: '0 2px 12px' }}>{diagram.description}</p>}

      <div className="card diagram-stage">
        {loading && <div className="muted mono" style={{ fontSize: 12 }}>Rendering diagram…</div>}
        {!loading && error && (
          <div>
            <div className="diagram-err">Diagram render failed:{'\n'}{error}</div>
            <details style={{ marginTop: 12 }}><summary className="muted" style={{ cursor: 'pointer' }}>Raw Mermaid source</summary><pre className="code-snippet" style={{ marginTop: 8 }}>{diagram?.mermaid}</pre></details>
          </div>
        )}
        {!loading && !error && <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', display: 'grid', placeItems: 'center' }} />}
      </div>
    </div>
  );
}
