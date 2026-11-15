import { useEffect, useState } from 'react';
import { IconCheck } from './icons';

const STEPS = [
  'Ingesting files & filtering noise',
  'Counting lines · classifying 9+ languages',
  'Resolving manifests (npm · pip · cargo · go · maven)',
  'Static import-graph for module coupling',
  'Linking client HTTP calls to server routes',
  'Running 30+ security rules & advisory DB',
  'Compiling Mermaid diagrams & dossier',
];

export default function ScanningScreen() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setDone(i + 1), 180 + i * 210));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="scanning">
      <div className="bg-fx" />
      <div className="scan-ring">
        <svg width="118" height="118" viewBox="0 0 118 118" fill="none">
          <circle cx="59" cy="59" r="52" stroke="rgba(52,245,165,0.12)" strokeWidth="6" />
          <circle cx="59" cy="59" r="52" stroke="#34f5a5" strokeWidth="6" strokeLinecap="round"
            strokeDasharray="90 240" opacity="0.95" style={{ filter: 'drop-shadow(0 0 10px rgba(52,245,165,0.6))' }} />
        </svg>
        <div className="scan-core">
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M32 6 L56 20 L56 44 L32 58 L8 44 L8 20 Z" fill="#0e1611" stroke="#34f5a5" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="32" cy="32" r="9" stroke="#34f5a5" strokeWidth="3" />
            <circle cx="32" cy="32" r="3" fill="#34f5a5" />
          </svg>
        </div>
      </div>
      <div className="scan-title">Decompiling the black box…</div>
      <div className="scan-steps">
        {STEPS.map((step, i) => (
          <div key={step} className={`scan-step${i < done ? ' done' : ''}`}>
            <span className="tick">{i < done ? <IconCheck size={13} /> : '·'}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
