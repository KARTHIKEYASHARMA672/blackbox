import { useEffect, useState } from 'react';
import { LLM_PRESETS, loadLLMConfig, saveLLMConfig, clearLLMConfig, testLLM } from '../../lib/llm';
import type { LLMConfig } from '../../lib/types';
import { PanelHead } from '../ui';
import { IconSettings, IconCheck, IconAlert, IconZap, IconX } from '../icons';

const EMPTY: LLMConfig = { providerName: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: 'openai/gpt-4o-mini' };

export default function SettingsPanel() {
  const [cfg, setCfg] = useState<LLMConfig>(() => loadLLMConfig() ?? EMPTY);
  const [activePreset, setActivePreset] = useState<string>(() => {
    const existing = loadLLMConfig();
    if (!existing) return 'openrouter';
    return LLM_PRESETS.find((p) => p.baseUrl === existing.baseUrl)?.id ?? 'custom';
  });
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setStatus(null);
  }, [cfg.baseUrl, cfg.model]);

  const applyPreset = (presetId: string) => {
    const preset = LLM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    setCfg((prev) => ({ ...prev, providerName: preset.name, baseUrl: preset.baseUrl, model: preset.model, apiKey: preset.needsKey ? prev.apiKey : '' }));
    setTestResult(null);
  };

  const save = () => {
    saveLLMConfig(cfg);
    setStatus('Configuration stored in this browser (localStorage key blackbox.llm.config.v1).');
  };

  const clear = () => {
    clearLLMConfig();
    setCfg(EMPTY);
    setActivePreset('openrouter');
    setTestResult(null);
    setStatus('Configuration cleared.');
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testLLM(cfg);
    setTesting(false);
    setTestResult(result.ok
      ? { ok: true, text: `HTTP 200 — endpoint responded in ${result.latencyMs}ms.\nModel output: ${result.content.trim().slice(0, 120)}` }
      : { ok: false, text: result.error ?? 'Unknown error' });
  };

  const activePresetObj = LLM_PRESETS.find((p) => p.id === activePreset);
  const keyMissing = activePresetObj?.needsKey && !cfg.apiKey.trim();

  return (
    <div className="panel">
      <PanelHead
        index="08"
        title="AI Engine"
        sub="BLACKBOX is open-engine: connect anything that speaks the OpenAI chat-completions protocol. Analysis stays offline — only the AI Assessment touches your provider."
      />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="preset-grid" role="radiogroup" aria-label="Provider presets">
            {LLM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                role="radio"
                aria-checked={activePreset === preset.id}
                className={`preset-card${activePreset === preset.id ? ' active' : ''}`}
                onClick={() => applyPreset(preset.id)}
              >
                <div className="preset-name">{preset.name}</div>
                <div className="preset-note">{preset.note ? preset.note.split('.')[0] + '.' : preset.baseUrl || 'Configure below'}</div>
              </button>
            ))}
          </div>

          {activePresetObj?.note && (
            <div className="note-box"><strong>{activePresetObj.name}:</strong> {activePresetObj.note}</div>
          )}

          <div className="card card-pad">
            <h3 className="card-title"><IconSettings size={14} /> Connection</h3>

            <div className="field">
              <label htmlFor="llm-baseurl">Base URL</label>
              <input id="llm-baseurl" className="input" value={cfg.baseUrl} onChange={(e) => { setCfg({ ...cfg, baseUrl: e.target.value }); setActivePreset('custom'); }} placeholder="https://api.openai.com/v1" autoComplete="off" spellCheck={false} />
              <div className="field-note">BLACKBOX calls <span style={{ color: 'var(--cyan)' }}>{(cfg.baseUrl.trim().replace(/\/+$/, '') || '…') + '/chat/completions'}</span></div>
            </div>

            <div className="field">
              <label htmlFor="llm-model">Model ID</label>
              <input id="llm-model" className="input" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder="gpt-4o-mini · llama3.3 · deepseek-chat · gemini-2.0-flash…" autoComplete="off" spellCheck={false} />
            </div>

            <div className="field">
              <label htmlFor="llm-key">{activePresetObj?.keyLabel ?? 'API Key'}</label>
              <input id="llm-key" className="input" type="password" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} placeholder={activePresetObj?.keyPlaceholder ?? 'sk-…'} autoComplete="off" spellCheck={false} />
              {keyMissing && <div className="field-note" style={{ color: 'var(--amber)' }}>This provider expects a key — paste one, or switch to an offline preset (Ollama / LM Studio).</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn btn-primary" onClick={save}><IconCheck size={14} /> Save</button>
              <button className="btn" onClick={test} disabled={testing}><IconZap size={14} /> {testing ? 'Pinging…' : 'Test connection'}</button>
              <button className="btn btn-danger" onClick={clear}><IconX size={14} /> Clear</button>
            </div>
            {status && <div className="field-note" style={{ marginTop: 10, color: '#9df0c3' }}>{status}</div>}
            {testResult && <div className={`test-result ${testResult.ok ? 'test-ok' : 'test-fail'}`}>{testResult.text}</div>}
          </div>
        </div>

        {/* honesty panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="note-box" style={{ borderLeftColor: 'var(--green)' }}>
            <strong>Privacy contract</strong><br />
            BLACKBOX has no backend. Your key lives only in this browser's localStorage and is sent only to the base URL you type above. Nothing else is transmitted anywhere, ever. Clear the config to wipe it.
          </div>
          <div className="note-box">
            <strong>What the model actually sees</strong><br />
            Only a <em>digest</em>: project name, file/LOC counts, language percentages, dependency names+versions, framework list, route table, and titles of findings. <span style={{ color: 'var(--cyan)' }}>Your source code is never sent.</span>
          </div>
          <div className="note-box" style={{ borderLeftColor: 'var(--amber)' }}>
            <strong>Local models</strong><br />
            Ollama: launch with <code>OLLAMA_ORIGINS=* ollama serve</code> (the browser needs CORS). LM Studio: enable the local server in the Developer tab. Any MLX / llama.cpp / vLLM / LocalAI / text-generation-webui server with an OpenAI-compatible endpoint works — pick Custom.
          </div>
          <div className="note-box" style={{ borderLeftColor: 'var(--cyan)' }}>
            <strong>Model suggestions</strong><br />
            Fast &amp; cheap: gpt-4o-mini · gemini-2.0-flash · llama-3.3-70b (Groq) · deepseek-chat.<br />
            Frontier reasoning: claude-sonnet-4 · gpt-5-codex · deepseek-r1 — via OpenRouter, one key for all.<br />
            Free tier: openrouter free community models (…:free) · Ollama local weights.
          </div>
        </div>
      </div>
    </div>
  );
}
