import { useCallback, useEffect, useRef, useState } from 'react';
import './index.css';
import type { AnalysisResult, WorkspaceTab } from './lib/types';
import type { CodeFile, SkippedFile } from './lib/types';
import { analyzeCodebase } from './lib/analyze';
import { collectFromFileList, collectFromDataTransfer, collectFromZip, finalizeRawFiles } from './lib/ingest';
import { generateMarkdown } from './lib/docs';
import { downloadText } from './lib/util';
import { SAMPLE_FILES, SAMPLE_PROJECT_NAME } from './lib/sampleProject';

import UploadScreen from './components/UploadScreen';
import ScanningScreen from './components/ScanningScreen';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import OverviewPanel from './components/panels/OverviewPanel';
import StructurePanel from './components/panels/StructurePanel';
import DiagramsPanel from './components/panels/DiagramsPanel';
import DependenciesPanel from './components/panels/DependenciesPanel';
import ApiMapPanel from './components/panels/ApiMapPanel';
import SecurityPanel from './components/panels/SecurityPanel';
import DocsPanel from './components/panels/DocsPanel';
import SettingsPanel from './components/panels/SettingsPanel';

type Stage = 'landing' | 'scanning' | 'workspace';

export default function App() {
  const [stage, setStage] = useState<Stage>('landing');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const pendingResult = useRef<AnalysisResult | null>(null);

  const runAnalysis = useCallback((projectName: string, files: CodeFile[], skipped: SkippedFile[]) => {
    setError(null);
    if (files.length === 0) {
      setError('No readable text files were found in the upload. Check that the archive contains source files (not only binaries) and try again.');
      return;
    }
    let result: AnalysisResult | null = null;
    try {
      result = analyzeCodebase(projectName, files, skipped);
    } catch (err) {
      console.error(err);
      setError(`Analysis crashed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    pendingResult.current = result;
    setStage('scanning');
  }, []);

  // Reveal the workspace once the scan theater finishes
  useEffect(() => {
    if (stage !== 'scanning') return;
    const timer = setTimeout(() => {
      setAnalysis(pendingResult.current);
      setActiveTab('overview');
      setAiBrief(null);
      setStage('workspace');
    }, 2100);
    return () => clearTimeout(timer);
  }, [stage]);

  const handlePickFolder = useCallback((files: FileList) => {
    collectFromFileList(files).then(({ projectName, files: parsed, skipped }) => runAnalysis(projectName, parsed, skipped))
      .catch((err) => setError(`Could not read the folder: ${err instanceof Error ? err.message : String(err)}`));
  }, [runAnalysis]);

  const handlePickZip = useCallback((file: File) => {
    collectFromZip(file).then(({ projectName, files, skipped }) => runAnalysis(projectName, files, skipped))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [runAnalysis]);

  const handleDrop = useCallback((items: DataTransferItemList, files: FileList) => {
    collectFromDataTransfer(items, files).then(({ projectName, files: parsed, skipped }) => runAnalysis(projectName, parsed, skipped))
      .catch((err) => setError(`Drop failed: ${err instanceof Error ? err.message : String(err)}`));
  }, [runAnalysis]);

  const handleLoadSample = useCallback(() => {
    const { files, skipped } = finalizeRawFiles(
      SAMPLE_FILES.map((f) => ({ path: f.path, content: f.content, size: new TextEncoder().encode(f.content).length })),
      SAMPLE_PROJECT_NAME,
    );
    runAnalysis(SAMPLE_PROJECT_NAME, files, skipped);
  }, [runAnalysis]);

  const handleExport = useCallback(() => {
    if (!analysis) return;
    downloadText(`${analysis.projectName}_BLACKBOX_REPORT.md`, generateMarkdown(analysis, aiBrief));
  }, [analysis, aiBrief]);

  const handleNewScan = useCallback(() => {
    setAnalysis(null);
    setAiBrief(null);
    setStage('landing');
  }, []);

  if (stage === 'scanning') return <ScanningScreen />;

  if (stage === 'landing' || !analysis) {
    return (
      <>
        <div className="scanlines" />
        <UploadScreen
          onPickFolder={handlePickFolder}
          onPickZip={handlePickZip}
          onDrop={handleDrop}
          onLoadSample={handleLoadSample}
          error={error}
        />
      </>
    );
  }

  const advisoryCount = analysis.advisories.length;
  const criticalHigh = analysis.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const counts: Partial<Record<WorkspaceTab, number>> = {
    structure: analysis.files.length,
    dependencies: analysis.dependencies.length,
    api: analysis.routes.length + analysis.calls.length,
    security: analysis.findings.length,
    diagrams: analysis.diagrams.length,
  };
  const alerts: Partial<Record<WorkspaceTab, boolean>> = {
    security: criticalHigh > 0,
    dependencies: advisoryCount > 0,
  };

  return (
    <>
      <div className="scanlines" />
      <div className="workspace">
        <TopBar analysis={analysis} onExport={handleExport} onNewScan={handleNewScan} />
        <div className="ws-body">
          <Sidebar active={activeTab} onChange={setActiveTab} counts={counts} alerts={alerts} projectName={analysis.projectName} />
          <main className="content">
            {activeTab === 'overview' && <OverviewPanel analysis={analysis} onNavigate={setActiveTab} />}
            {activeTab === 'structure' && <StructurePanel analysis={analysis} />}
            {activeTab === 'diagrams' && <DiagramsPanel analysis={analysis} />}
            {activeTab === 'dependencies' && <DependenciesPanel analysis={analysis} />}
            {activeTab === 'api' && <ApiMapPanel analysis={analysis} onNavigate={setActiveTab} />}
            {activeTab === 'security' && <SecurityPanel analysis={analysis} />}
            {activeTab === 'docs' && <DocsPanel analysis={analysis} aiBrief={aiBrief} onSetAiBrief={setAiBrief} onNavigate={setActiveTab} />}
            {activeTab === 'settings' && <SettingsPanel />}
          </main>
        </div>
      </div>
    </>
  );
}
