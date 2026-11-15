import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../lib/types';
import { copyToClipboard, formatBytes } from '../../lib/util';
import { PanelHead, EmptyState } from '../ui';
import FileTree from '../FileTree';
import { IconCopy, IconCheck, IconTree } from '../icons';

interface Props {
  analysis: AnalysisResult;
}

export default function StructurePanel({ analysis }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const a = analysis;

  const findingsByFile = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of a.findings) map.set(f.file, (map.get(f.file) ?? 0) + 1);
    return map;
  }, [a.findings]);

  const selectedFile = useMemo(
    () => (selected ? a.files.find((f) => f.path === selected) ?? null : null),
    [selected, a.files],
  );

  const previewLines = selectedFile ? selectedFile.content.split('\n').slice(0, 400) : [];
  const hidden = selectedFile && selectedFile.content.split('\n').length > 400;

  return (
    <div className="panel">
      <PanelHead
        index="02"
        title="Structure"
        sub={`${a.totals.files} files · ${a.totals.lines.toLocaleString()} lines · ${formatBytes(a.totals.bytes)} · ${a.totals.commentLines.toLocaleString()} comment lines (${Math.round((a.totals.commentLines / Math.max(1, a.totals.lines)) * 100)}%)`}
      />

      {a.skipped.length > 0 && (
        <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 12 }}>
          Skipped {a.skipped.length} file(s): {a.skipped.slice(0, 4).map((s) => s.path.split('/').pop()).join(', ')}{a.skipped.length > 4 ? ', …' : ''}
        </div>
      )}

      <div className="tree-layout">
        <FileTree root={a.tree} findingsByFile={findingsByFile} selectedPath={selected} onSelect={setSelected} />

        <div className="card preview">
          {selectedFile ? (
            <>
              <div className="preview-head">
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.path}</div>
                  <div className="muted" style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>
                    {selectedFile.language ?? 'plaintext'} · {selectedFile.lines} lines · {formatBytes(selectedFile.size)}{selectedFile.truncated ? ' · truncated (>512 KB)' : ''}
                  </div>
                </div>
                <button className="btn btn-sm btn-icon" title="Copy file content" onClick={async () => { if (await copyToClipboard(selectedFile.content)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </button>
              </div>
              <pre>
                {previewLines.map((line, i) => (
                  <div className="preview-line" key={i}>
                    <span className="preview-ln">{i + 1}</span>
                    <span>{line || ' '}</span>
                  </div>
                ))}
                {hidden && <div className="preview-line"><span className="preview-ln">…</span><span className="muted">file truncated in preview</span></div>}
              </pre>
            </>
          ) : (
            <EmptyState
              title="Select a file to read it"
              hint="Click any file in the tree. Files carrying findings show a red badge — start there. Nothing leaves your browser."
              icon={<IconTree size={40} strokeWidth={1.2} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
