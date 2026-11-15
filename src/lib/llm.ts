import type { AnalysisResult, LLMConfig } from './types';

export interface LLMPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  keyLabel: string;
  keyPlaceholder: string;
  needsKey: boolean;
  note?: string;
}

export const LLM_PRESETS: LLMPreset[] = [
  {
    id: 'opencode', name: 'OpenCode Zen', baseUrl: 'https://opencode.ai/inference',
    model: '',
    keyLabel: 'OpenCode Zen API key', keyPlaceholder: 'op-… (from opencode.ai/console)',
    needsKey: true,
    note: 'OpenCode’s hosted model gateway (pay-as-you-go). Uses the OpenAI-compatible API; model id comes from your OpenCode console. If your plan differs, adjust the base URL (e.g. /inference/go).',
  },
  {
    id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    keyLabel: 'OpenRouter API key', keyPlaceholder: 'sk-or-v1-…',
    needsKey: true,
    note: 'One key → 300+ models (OpenAI, Anthropic, Google, DeepSeek, Llama…). Free community models exist — set any free model id (suffix ":free").',
  },
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyLabel: 'OpenAI API key', keyPlaceholder: 'sk-…',
    needsKey: true,
  },
  {
    id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    keyLabel: 'Gemini API key', keyPlaceholder: 'AIza…',
    needsKey: true,
    note: 'Uses Google’s OpenAI-compatible endpoint — one key, Gemini models.',
  },
  {
    id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyLabel: 'DeepSeek API key', keyPlaceholder: 'sk-…',
    needsKey: true,
  },
  {
    id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyLabel: 'Groq API key', keyPlaceholder: 'gsk_…',
    needsKey: true,
    note: 'Extremely fast open-weight inference.',
  },
  {
    id: 'mistral', name: 'Mistral La Plateforme', baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    keyLabel: 'Mistral API key', keyPlaceholder: '…',
    needsKey: true,
  },
  {
    id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    keyLabel: 'API key (not required)', keyPlaceholder: 'leave empty',
    needsKey: false,
    note: '100% offline. Run: OLLAMA_ORIGINS=* ollama serve — BLACKBOX runs in your browser, so Ollama must allow browser origins.',
  },
  {
    id: 'lmstudio', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1',
    model: '',
    keyLabel: 'API key (not required)', keyPlaceholder: 'leave empty',
    needsKey: false,
    note: 'Start the LM Studio server and enable its local REST API. Set model to the served model identifier.',
  },
  {
    id: 'opencode-local', name: 'OpenCode (local)', baseUrl: 'http://127.0.0.1:4096',
    model: '',
    keyLabel: 'API key (if configured)', keyPlaceholder: 'optional',
    needsKey: false,
    note: 'Point at any OpenAI-compatible server you run — including a self-hosted OpenCode gateway. Any OpenAI-compatible endpoint works: just paste its base URL.',
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', baseUrl: '',
    model: '',
    keyLabel: 'API key', keyPlaceholder: 'optional — leave empty if not required',
    needsKey: false,
    note: 'Any endpoint implementing POST {baseUrl}/chat/completions — vLLM, LocalAI, text-generation-webui, Azure gateways, corporate proxies…',
  },
];

const STORAGE_KEY = 'blackbox.llm.config.v1';

export function loadLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LLMConfig;
    if (typeof parsed.baseUrl !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLLMConfig(cfg: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function endpointOf(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

export interface ChatResult { ok: boolean; content: string; latencyMs: number; error?: string }

export async function chatCompletion(cfg: LLMConfig, messages: { role: string; content: string }[], opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }): Promise<ChatResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 90_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`;
    const res = await fetch(endpointOf(cfg.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 1800,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      let hint = '';
      if (res.status === 401 || res.status === 403) hint = ' — check your API key and model permissions.';
      else if (res.status === 404) hint = ' — endpoint not found. Bases URL usually ends with /v1 (e.g. https://api.openai.com/v1).';
      else if (res.status === 429) hint = ' — rate limited or quota exhausted.';
      return { ok: false, content: '', latencyMs, error: `HTTP ${res.status}${hint}\n${detail}` };
    }
    const json = await res.json();
    const content: string | undefined = json?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, content: '', latencyMs, error: 'Response did not contain choices[0].message.content — is this an OpenAI-compatible endpoint?' };
    }
    return { ok: true, content, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const msg = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out — the model may be slow or the endpoint is unreachable.'
      : `Network error — is the server reachable? If using a local server (Ollama/LM Studio), it must allow browser origins (CORS). Underlying: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, content: '', latencyMs, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export async function testLLM(cfg: LLMConfig): Promise<ChatResult> {
  if (!cfg.baseUrl.trim()) return { ok: false, content: '', latencyMs: 0, error: 'Base URL is empty.' };
  if (!cfg.model.trim()) return { ok: false, content: '', latencyMs: 0, error: 'Model id is empty. Pick a model the server serves.' };
  return chatCompletion(cfg, [{ role: 'user', content: 'Reply with exactly: BLACKBOX-OK' }], { maxTokens: 16, temperature: 0, timeoutMs: 45_000 });
}

function buildBriefContext(a: AnalysisResult): string {
  const sevCounts: Record<string, number> = {};
  for (const f of a.findings) sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
  const topFindings = a.findings.slice(0, 18).map((f) => `- [${f.severity.toUpperCase()}] ${f.ruleId} ${f.title} (${f.file}${f.line ? `:${f.line}` : ''})`).join('\n');
  const depList = a.dependencies.slice(0, 40).map((d) => `${d.name}@${d.version} (${d.type})`).join(', ');
  const routes = a.routes.slice(0, 40).map((r) => `${r.method} ${r.path} [${r.framework}] ${r.file}:${r.line}`).join('\n');
  const langs = a.languages.map((l) => `${l.language}: ${l.pct.toFixed(1)}% (${l.lines} lines, ${l.files} files)`).join('\n');

  return `PROJECT: ${a.projectName}
CLASSIFICATION: ${a.projectTypes.join(', ')}
FRAMEWORKS: ${a.frameworks.join(', ') || 'none detected'}
ENTRY POINTS: ${a.entryPoints.join(', ') || 'none detected'}
SIZE: ${a.totals.files} files · ${a.totals.codeLines} LOC · ${(a.totals.bytes / 1024).toFixed(0)} KB
SECURITY SCORE: ${a.score}/100 (grade ${a.grade}, ${a.riskLabel})
FINDINGS BY SEVERITY: ${JSON.stringify(sevCounts)}
LANGUAGES:
${langs}
DEPENDENCIES (first 40): ${depList}
ADVISORIES: ${a.advisories.map((x) => `${x.name}@${x.version} [${x.severity}]`).join(', ') || 'none'}
ROUTES (first 40):
${routes || 'none detected'}
TOP FINDINGS:
${topFindings || 'none'}`;
}

export async function generateAIBrief(cfg: LLMConfig, a: AnalysisResult): Promise<ChatResult> {
  const context = buildBriefContext(a);
  const messages = [
    {
      role: 'system',
      content: 'You are a principal application security architect and staff engineer performing an authorized codebase review. Be concrete, technical and honest. Do not invent findings that are not supported by the data. If information is missing, say so. Format output as Markdown with these exact sections: "## Architecture Assessment", "## Security Posture", "## Tech Debt & Risks", "## Recommended Next Steps" (numbered list). Keep under 600 words.',
    },
    {
      role: 'user',
      content: `Assess this codebase from the static analysis data below. Do not ask follow-up questions — deliver the assessment.\n\n${context}`,
    },
  ];
  return chatCompletion(cfg, messages, { maxTokens: 1900, temperature: 0.25, timeoutMs: 120_000 });
}
