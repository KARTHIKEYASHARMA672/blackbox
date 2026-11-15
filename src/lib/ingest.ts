import { unzipSync } from 'fflate';
import type { CodeFile, SkippedFile } from './types';
import { countLines, detectLanguage } from './structure';

const MAX_FILES = 4000;
const MAX_FILE_BYTES = 512 * 1024;      // read content up to this size
const MAX_TOTAL_BYTES = 45 * 1024 * 1024;

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', '.next', '.nuxt', '.output',
  'dist', 'build', 'out', 'coverage', '.turbo', '.cache', '.svelte-kit', '.vercel',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', 'venv', '.venv', 'env',
  'target', 'vendor', 'bin', 'obj', '.gradle', '.dart_tool', 'Pods', '.expo',
]);

const IGNORED_BASENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'gemfile.lock',
  'poetry.lock', 'cargo.lock', 'go.sum', '.ds_store', 'thumbs.db', 'license', 'license.md',
]);

const IGNORED_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff', 'avif',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'exe', 'dll', 'so', 'dylib', 'class', 'jar', 'war', 'ear',
  'zip', 'gz', 'tar', '7z', 'rar', 'bz2', 'zst',
  'mp4', 'mp3', 'mov', 'avi', 'wav', 'mkv', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'wasm', 'pyc', 'pyo', 'map',
]);

export interface RawInput { path: string; content: Uint8Array | string | null; size: number }
export interface IngestResult { projectName: string; files: CodeFile[]; skipped: SkippedFile[] }

function shouldSkipDirSegment(segment: string): boolean {
  return IGNORED_DIRS.has(segment.toLowerCase());
}

export function isIgnorablePath(path: string): boolean {
  const segments = path.split('/');
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (shouldSkipDirSegment(segments[i])) return true;
  }
  const base = (segments[segments.length - 1] ?? '').toLowerCase();
  if (IGNORED_BASENAMES.has(base)) return true;
  if (base.endsWith('.min.js') || base.endsWith('.min.css')) return true;
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
  if (ext && IGNORED_EXT.has(ext)) return true;
  return false;
}

function looksBinary(text: string): boolean {
  const sample = text.slice(0, 8192);
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13 && code !== 27) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.1;
}

export function finalizeRawFiles(raw: RawInput[], projectName: string): IngestResult {
  const files: CodeFile[] = [];
  const skipped: SkippedFile[] = [];
  let totalBytes = 0;

  const sorted = [...raw].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    if (files.length >= MAX_FILES) {
      skipped.push({ path: item.path, reason: `file limit (${MAX_FILES}) reached` });
      continue;
    }
    if (isIgnorablePath(item.path)) continue; // silently ignored (noise)
    const cleanPath = item.path.replace(/^\.?\//, '').replace(/\\/g, '/');

    if (totalBytes >= MAX_TOTAL_BYTES) {
      skipped.push({ path: cleanPath, reason: 'size cap reached' });
      continue;
    }

    if (item.content == null) {
      skipped.push({ path: cleanPath, reason: 'unreadable (binary or empty read)' });
      continue;
    }

    let text: string;
    if (typeof item.content === 'string') {
      text = item.content;
    } else {
      try {
        text = new TextDecoder('utf-8', { fatal: false }).decode(item.content);
      } catch {
        skipped.push({ path: cleanPath, reason: 'could not decode as UTF-8' });
        continue;
      }
    }

    if (looksBinary(text)) {
      skipped.push({ path: cleanPath, reason: 'binary content' });
      continue;
    }

    const truncated = item.size > MAX_FILE_BYTES;
    if (truncated) text = text.slice(0, MAX_FILE_BYTES);

    const language = detectLanguage(cleanPath);
    const stats = countLines(text, language);
    files.push({
      path: cleanPath,
      size: item.size,
      content: text,
      truncated,
      language,
      ...stats,
    });
    totalBytes += item.size;
  }

  return { projectName: projectName || 'codebase', files, skipped };
}

// ---------- folder upload (<input webkitdirectory> / picker) ----------

export async function collectFromFileList(list: FileList, projectNameHint?: string): Promise<IngestResult> {
  const raw: RawInput[] = [];
  const files = Array.from(list);
  const root = files[0]?.webkitRelativePath?.split('/')[0] || projectNameHint || 'codebase';
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    if (file.size > MAX_FILE_BYTES) {
      raw.push({ path, content: null, size: file.size });
      continue;
    }
    try {
      const buf = await file.arrayBuffer();
      raw.push({ path, content: new Uint8Array(buf), size: file.size });
    } catch {
      raw.push({ path, content: null, size: file.size });
    }
  }
  return finalizeRawFiles(raw, root);
}

// ---------- drag & drop (with directory traversal) ----------

interface WebkitFileEntry {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  name: string;
  file?: (cb: (f: File) => void, errCb?: (e: unknown) => void) => void;
  createReader?: () => WebkitDirReader;
}
interface WebkitDirReader {
  readEntries: (cb: (entries: WebkitFileEntry[]) => void, errCb?: (e: unknown) => void) => void;
}

function readAllEntries(reader: WebkitDirReader): Promise<WebkitFileEntry[]> {
  return new Promise((resolve, reject) => {
    const all: WebkitFileEntry[] = [];
    const pump = () => {
      reader.readEntries((batch) => {
        if (!batch || batch.length === 0) resolve(all);
        else { all.push(...batch); pump(); }
      }, reject);
    };
    pump();
  });
}

function entryToFile(entry: WebkitFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!entry.file) return reject(new Error('not a file entry'));
    entry.file(resolve, reject);
  });
}

async function walkEntry(entry: WebkitFileEntry, base: string, out: RawInput[], depth: number): Promise<void> {
  if (depth > 24) return;
  if (out.length >= MAX_FILES) return;
  if (entry.isDirectory) {
    const dirName = entry.name;
    if (shouldSkipDirSegment(dirName)) return;
    const reader = entry.createReader?.();
    if (!reader) return;
    const children = await readAllEntries(reader);
    for (const child of children) {
      await walkEntry(child, base ? `${base}/${dirName}` : dirName, out, depth + 1);
    }
    return;
  }
  if (entry.isFile) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    try {
      const file = await entryToFile(entry);
      if (file.size > MAX_FILE_BYTES) {
        out.push({ path: rel, content: null, size: file.size });
        return;
      }
      const buf = await file.arrayBuffer();
      out.push({ path: rel, content: new Uint8Array(buf), size: file.size });
    } catch {
      out.push({ path: rel, content: null, size: 0 });
    }
  }
}

export async function collectFromDataTransfer(items: DataTransferItemList, fallbackFiles: FileList): Promise<IngestResult> {
  const entries: WebkitFileEntry[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const entry = (item.webkitGetAsEntry?.() ?? null) as unknown as WebkitFileEntry | null;
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) {
    return collectFromFileList(fallbackFiles, 'dropped-codebase');
  }
  const raw: RawInput[] = [];
  const roots: string[] = [];
  for (const entry of entries) {
    await walkEntry(entry, '', raw, 0);
    if (entry.isDirectory) roots.push(entry.name);
  }
  const projectName = roots.length === 1 ? roots[0] : (roots.length > 1 ? roots.join(' + ') : 'dropped-codebase');
  // For single folder drops, strip a duplicated root prefix if walkEntry kept it
  return finalizeRawFiles(raw, projectName);
}

// ---------- zip upload ----------

const ZIP_TEXT_EXT = new Set([
  'ts','tsx','js','jsx','mjs','cjs','mts','cts','py','java','kt','kts','scala','go','rs','rb','php','cs','c','h','cpp','cc','hpp','swift','m','dart','lua','r','jl','sql','graphql','html','htm','vue','svelte','astro','css','scss','sass','less','json','yaml','yml','toml','xml','md','mdx','rst','txt','env','ini','cfg','conf','properties','proto','tf','hcl','sh','bash','zsh','ps1','bat','cmd','dockerfile','gitignore','npmrc','editorconfig','prettierrc','eslintrc','lock','example','sample',
]);

export async function collectFromZip(file: File): Promise<IngestResult> {
  const projectName = file.name.replace(/\.zip$/i, '') || 'codebase';
  const bytes = new Uint8Array(await file.arrayBuffer());
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch (err) {
    throw new Error(`Could not read "${file.name}" as a .zip archive — ${err instanceof Error ? err.message : String(err)}`);
  }

  // Strip a single common top-level folder (repo archives)
  const names = Object.keys(unzipped);
  const topFolders = new Set(names.map((n) => n.split('/')[0]).filter(Boolean));
  const stripPrefix = topFolders.size === 1 ? [...topFolders][0] + '/' : '';

  const raw: RawInput[] = [];
  for (const [name, data] of Object.entries(unzipped)) {
    const path = stripPrefix && name.startsWith(stripPrefix) ? name.slice(stripPrefix.length) : name;
    if (!path || name.endsWith('/')) continue;
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
    const looksTextual = !ext || ZIP_TEXT_EXT.has(ext) || !ext;
    if (data.length > MAX_FILE_BYTES) {
      raw.push({ path, content: looksTextual ? data.subarray(0, MAX_FILE_BYTES) : null, size: data.length });
      continue;
    }
    raw.push({ path, content: data, size: data.length });
  }
  return finalizeRawFiles(raw, projectName);
}
