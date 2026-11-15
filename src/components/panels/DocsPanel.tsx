import { useMemo, useState } from 'react';
import { marked } from 'marked';
import type { AnalysisResult, WorkspaceTab } from '../../lib/types';
import { generateMarkdown } from '../../lib/docs';
import { loadLLMConfig, generateAIBrief } from '../../lib/llm';
import { copyToClipboard, downloadText } from '../../lib/util';
import { PanelHead } from '../ui';
import { IconCopy, IconCheck, IconDownload, IconZap, IconDocs, IconSettings, IconAlert } from '../icons';

interface Props {
  analysis: AnalysisResult;
  aiBrief: string | null;
  onSetAiBrief: (brief: string | null) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

export default function DocsPanel({ analysis, aiBrief, onSetAiBrief, onNavigate }: Props) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [finishedIn, setFinishedIn] = useState<number | null>(null);

  const markdown = useMemo(() => generateMarkdown(analysis, aiBrief), [analysis, aiBrief]);
  const html = useMemo(() => marked.parse(markdown, { async: false }) as string, [markdown]);
  const wordCount = useMemo(() => markdown.split(/\s+/).filter(Boolean).length, [markdown]);
  const llm = loadLLMConfig();

  const runBrief = async () => {
    if (!llm) return;
    setGenerating(true);
    setGenError(null);
    const result = await generateAIBrief(llm, analysis);
    setGenerating(false);
    if (result.ok) {
      onSetAiBrief(result.content);
      setFinishedIn(result.latencyMs);
    } else {
      setGenError(result.error ?? 'Unknown error contacting the model.');
    }
  };

  return (
    <div className="panel">
      <PanelHead
        index="07"
        title="Developer Dossier"
        sub={`Complete generated documentation — ${wordCount.toLocaleString()} words, every section included. Copy it, download it, or let your LLM write the executive assessment.`}
        actions={
          <>
            <button className="btn btn-sm" onClick={async () => { if (await copyToClipboard(markdown)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} Copy Markdown
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => downloadText(`${analysis.projectName}_BLACKBOX_REPORT.md`, markdown)}>
              <IconDownload size={13} /> Download .md
            </button>
          </>
        }
      />

      <div className="docs-layout">
        {/* rendered report */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="preview-head">
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              BLACKBOX REPORT PREVIEW · {analysis.projectName}
            </div>
            <span className="chip chip-green">LIVE</span>
          </div>
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        {/* AI brief rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-pad brief-box">
            <h3 className="card-title" style={{ color: 'var(--cyan)' }}><IconZap size={14} /> AI architecture assessment</h3>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.65, margin: '0 0 10px' }}>
              Sends a <strong>condensed digest</strong> — stats, language mix, dependency list, route table and finding titles (never full source) — to the LLM you configured in AI Engine. The result is appended to your report.
            </p>

            {llm ? (
              <>
                <div className="mono" style={{ fontSize: 10.5, marginBottom: 10, color: 'var(--text)' }}>
                  Provider: <span style={{ color: 'var(--cyan)' }}>{llm.providerName}</span><br />
                  Model: <span style={{ color: 'var(--cyan)' }}>{llm.model || '(model id empty — set it in AI Engine)'}</span><br />
                  Endpoint: <span style={{ color: 'var(--muted)' }}>{llm.baseUrl}</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={runBrief} disabled={generating || !llm.model.trim()}>
                  {generating ? 'Contacting model…' : aiBrief ? 'Regenerate assessment' : 'Generate assessment'}
                </button>
                {finishedIn !== null && !generating && <div className="muted mono" style={{ fontSize: 10, marginTop: 6 }}>Completed in {finishedIn}ms</div>}
              </>
            ) : (
              <>
                <p style={{ fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.6, margin: '0 0 10px' }}>
                  <IconAlert size={12} style={{ verticalAlign: '-2px' }} /> No LLM connected yet. BLACKBOX is fully functional offline — connect one to unlock the narrative assessment.
                </p>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onNavigate('settings')}>
                  <IconSettings size={14} /> Connect an AI engine
                </button>
              </>
            )}

            {genError && <div className="test-result test-fail" style={{ marginTop: 10 }}>{genError}</div>}

            {aiBrief && !generating && (
              <div style={{ marginTop: 12 }}>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Assessment received</div>
                <div className="brief-result markdown-body" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'rgba(0,0,0,0.3)', maxHeight: 420, overflow: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(aiBrief, { async: false }) as string }} />
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => onSetAiBrief(null)}>Discard assessment</button>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <h3 className="card-title"><IconDocs size={14} /> Included sections</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 11.5, lineHeight: 2.1, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              {[
                'Executive summary & verdict',
                'Project profile & how-to-run',
                'Language & directory composition',
                'Dependency inventory + advisories',
                'Full API surface (routes & calls)',
                'Security findings & remediation',
                'Architecture (Mermaid) embed',
                'Remediation roadmap',
                'Appendix A — AI assessment',
                'Appendix B — File inventory',
              ].map((s) => (
                <li key={s}><span style={{ color: 'var(--green)' }}>▸</span> {s}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
