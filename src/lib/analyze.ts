import type { AnalysisResult, SkippedFile } from './types';
import type { CodeFile } from './types';
import { analyzeStructure } from './structure';
import { extractDependencies, findAdvisories } from './dependencies';
import { extractApiMap } from './api';
import { scanSecurity } from './security';
import { buildDiagrams } from './diagrams';

export function analyzeCodebase(projectName: string, files: CodeFile[], skipped: SkippedFile[]): AnalysisResult {
  const started = performance.now();

  const structure = analyzeStructure(files, projectName);
  const dependencies = extractDependencies(files);
  const advisories = findAdvisories(dependencies);
  const { routes, calls } = extractApiMap(files);
  const security = scanSecurity(files, advisories);

  const durationMs = Math.round(performance.now() - started);

  const result: AnalysisResult = {
    projectName,
    scannedAt: Date.now(),
    durationMs,
    files,
    skipped,
    totals: structure.totals,
    languages: structure.languages,
    tree: structure.tree,
    topDirs: structure.topDirs,
    frameworks: structure.frameworks,
    projectTypes: structure.projectTypes,
    entryPoints: structure.entryPoints,
    scripts: structure.scripts,
    dependencies,
    advisories,
    routes,
    calls,
    findings: security.findings,
    score: security.score,
    grade: security.grade,
    riskLabel: security.riskLabel,
    riskColor: security.riskColor,
    diagrams: [],
  };

  result.diagrams = buildDiagrams(files, result);
  return result;
}
