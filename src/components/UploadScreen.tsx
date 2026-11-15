import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import {
  IconUpload, IconFolder, IconZip, IconArrowRight, IconAlert, IconZap,
  IconTree, IconDiagram, IconPackage, IconApi, IconShield, IconDocs,
} from './icons';

interface UploadScreenProps {
  onPickFolder: (files: FileList) => void;
  onPickZip: (file: File) => void;
  onDrop: (items: DataTransferItemList, files: FileList) => void;
  onLoadSample: () => void;
  error: string | null;
}

const FEATURES = [
  { icon: IconTree, title: 'Structure Analysis', desc: 'Language breakdown, LOC metrics, top directories, entry points, framework & project-type detection.' },
  { icon: IconDiagram, title: 'Architecture Diagrams', desc: 'Import-graph module map, client→API flow, tech-stack mindmap & language pie — rendered with Mermaid.' },
  { icon: IconPackage, title: 'Dependency Detection', desc: 'npm, pip, Cargo, Go, Maven, Gradle, RubyGems, Composer & NuGet — plus an offline vulnerable-package database.' },
  { icon: IconApi, title: 'API Mapping', desc: 'Server routes (Express, FastAPI, Django, Spring, Next.js…) statically linked to every client-side HTTP call.' },
  { icon: IconShield, title: 'Security Scanning', desc: '28+ rule pack: committed secrets, injection sinks, TLS bypass, weak crypto, CORS, debug flags & more.' },
  { icon: IconDocs, title: 'Developer Docs', desc: 'A complete Markdown report — architecture, deps, API surface, findings & remediation roadmap — one click to export.' },
];

const STEPS = [
  { n: '01', title: 'Drop the target', desc: 'Upload a .zip or a folder. Everything stays in your browser — nothing is transmitted.' },
  { n: '02', title: 'Run the pipeline', desc: 'Structure, imports, manifests, routes, calls & 28 security rulepacks — computed in milliseconds.' },
  { n: '03', title: 'Export the dossier', desc: 'Copy the report, download BLACKBOX.md, or let your own LLM write the architecture assessment.' },
];

export default function UploadScreen({ onPickFolder, onPickZip, onDrop, onLoadSample, error }: UploadScreenProps) {
  const [dragOver, setDragOver] = useState(false);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const setWebkitDir = useCallback((el: HTMLInputElement | null) => {
    folderRef.current = el;
    if (el) el.setAttribute('webkitdirectory', '');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (dt && dt.items && dt.items.length > 0) onDrop(dt.items, dt.files);
  }, [onDrop]);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  return (
    <div className="landing">
      <div className="bg-fx" />
      <div className="landing-inner">
        {/* nav */}
        <nav className="landing-nav">
          <div className="brand">
            <Logo size={38} />
            <span>
              <span className="brand-name">BLACK<em>BOX</em></span>
              <span className="brand-tag">AI Software Reverse Engineering Lab</span>
            </span>
          </div>
          <div className="nav-right">
            <span className="chip chip-green"><IconZap size={11} /> 100% client-side</span>
            <span className="chip chip-cyan">BYO-LLM</span>
            <span className="chip">v1.0</span>
          </div>
        </nav>

        {/* hero */}
        <section className="hero">
          <div>
            <span className="hero-kicker"><span className="pulse-dot" /> Static analysis · No upload · No signup</span>
            <h1>
              Open the<br />
              <span className="glyph">black</span> <span className="glow">box.</span>
            </h1>
            <p className="lede">
              BLACKBOX ingests an entire codebase and tells you <b>how it works</b>: what it is,
              what it depends on, where the APIs are, what it leaks, and how to fix it —
              <b> illustrated with live architecture diagrams</b> and a complete developer dossier.
            </p>

            <div className={`dropzone${dragOver ? ' drag-over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload a codebase to analyze"
              onClick={() => folderRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') folderRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-dragging={dragOver}
            >
              <IconUpload size={52} strokeWidth={1.4} className="drop-icon" />
              <h3>Drop a codebase here</h3>
              <p>.zip archive <em>or</em> project folder — up to ~4,000 files</p>
              <div className="drop-actions">
                <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}>
                  <IconFolder size={15} /> Browse folder
                </button>
                <button className="btn" onClick={(e) => { e.stopPropagation(); zipRef.current?.click(); }}>
                  <IconZip size={15} /> Browse .zip
                </button>
              </div>
              <input ref={setWebkitDir} type="file" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files.length) onPickFolder(e.target.files); e.currentTarget.value = ''; }} />
              <input ref={zipRef} type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickZip(f); e.currentTarget.value = ''; }} />
              <div className="sample-link">
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onLoadSample(); }}>
                  No codebase handy? Load the demo target <IconArrowRight size={13} />
                </button>
              </div>
              <div className="drop-meta">JS · TS · PY · JAVA · GO · RS · RB · PHP · C# · C/C++ · DART · SWIFT&nbsp;&nbsp;|&nbsp;&nbsp;EVERYTHING RUNS IN THIS TAB</div>
            </div>

            {error && (
              <div className="error-banner"><IconAlert size={16} /><span>{error}</span></div>
            )}
          </div>

          {/* right rail: terminal readout */}
          <div>
            <div className="terminal" aria-hidden="true">
              <div className="t-line"><span className="t-dim">$</span> blackbox scan ./shipyard-api</div>
              <div className="t-line"><span className="t-dim">[00.012s]</span> ingesting <span className="t-ok">16 files</span> · 512 KB · 9 languages</div>
              <div className="t-line"><span className="t-dim">[00.041s]</span> graph: <span className="t-ok">14 modules</span> · 31 cross-imports</div>
              <div className="t-line"><span className="t-dim">[00.068s]</span> deps: <span className="t-ok">12 resolved</span> · <span className="t-warn">4 advisories</span></div>
              <div className="t-line"><span className="t-dim">[00.093s]</span> routes <span className="t-ok">11 mapped</span> · findings <span className="t-warn">17</span></div>
              <div className="t-line"><span className="t-dim">$</span> dossier ready — <span className="t-ok">BLACKBOX.md</span> <span className="caret" /></div>
            </div>

            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <span className="step-num">{s.n}</span>
                  <span>
                    <h5>{s.title}</h5>
                    <p>{s.desc}</p>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* features */}
        <div className="section-label">One codebase in. <span>Every answer out.</span></div>
        <div className="features">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon"><Icon size={18} /></div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            );
          })}
        </div>

        <footer className="landing-footer">
          <span>BLACKBOX — STATIC FORENSICS FOR CODE</span>
          <span>REACT · TYPESCRIPT · MERMAID · FFLATE · OPENAI-COMPATIBLE</span>
          <span>NO TELEMETRY · NO BACKEND · NO MERCY</span>
        </footer>
      </div>
    </div>
  );
}
