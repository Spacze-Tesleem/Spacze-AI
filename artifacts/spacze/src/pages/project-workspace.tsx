import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import {
  useGetProject,
  getGetProjectQueryKey,
  useListProjectFiles,
  getListProjectFilesQueryKey,
  useUpdateProjectFile,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';
import {
  FileCode,
  Folder,
  FolderOpen,
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Bug,
  ChevronRight,
  ChevronDown,
  Play,
  Check,
  Terminal,
  RefreshCw,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

// ─── File tree ────────────────────────────────────────────────────────────────

function buildTree(files: any[]) {
  const root: any = { name: 'root', type: 'folder', children: {}, path: '' };
  files.forEach((file) => {
    const parts = file.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current.children[part] = { ...file, name: part, type: 'file' };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'folder',
            children: {},
            path: parts.slice(0, i + 1).join('/'),
          };
        }
        current = current.children[part];
      }
    }
  });
  return root;
}

// Language → colour mapping for file icons
const LANG_COLORS: Record<string, string> = {
  typescript: 'text-sky-400',
  javascript: 'text-yellow-400',
  python:     'text-teal-400',
  html:       'text-orange-400',
  css:        'text-violet-400',
  json:       'text-amber-400',
  markdown:   'text-muted-foreground',
};

function FileTreeNode({
  node,
  level,
  selectedId,
  onSelect,
}: {
  node: any;
  level: number;
  selectedId: number | null;
  onSelect: (node: any) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const isFile = node.type === 'file';
  const indent = level * 14 + 10;
  const langColor = LANG_COLORS[node.language] ?? 'text-muted-foreground';

  if (isFile) {
    const isSelected = selectedId === node.id;
    return (
      <button
        className={cn(
          'w-full flex items-center gap-2 py-[5px] text-[12.5px] font-mono rounded-md transition-colors text-left group',
          isSelected
            ? 'bg-[hsl(258,90%,66%,0.12)] text-foreground border border-[hsl(258,90%,66%,0.2)]'
            : 'text-muted-foreground hover:bg-[hsl(220,13%,16%)] hover:text-foreground border border-transparent',
        )}
        style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
        onClick={() => onSelect(node)}
      >
        <FileCode className={cn('w-3.5 h-3.5 shrink-0', isSelected ? langColor : 'opacity-50')} />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 py-[5px] text-[12.5px] font-mono text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,16%)] rounded-md transition-colors text-left"
        style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
          : <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
        }
        {expanded
          ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-400/70" />
          : <Folder className="w-3.5 h-3.5 shrink-0 text-amber-400/50" />
        }
        <span className="truncate">{node.name}</span>
      </button>
      {expanded &&
        (Object.values(node.children) as any[])
          .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
          })
          .map((child) => (
            <FileTreeNode
              key={child.name}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectWorkspace() {
  const { id } = useParams();
  const projId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projId, {
    query: { enabled: !!projId, queryKey: getGetProjectQueryKey(projId) },
  });
  const { data: rawFiles } = useListProjectFiles(projId, {
    query: { enabled: !!projId, queryKey: getListProjectFilesQueryKey(projId) },
  });
  const files = Array.isArray(rawFiles) ? rawFiles : undefined;

  const updateFileMutation = useUpdateProjectFile();

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const prevSelectedIdRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'generate' | 'debug' | 'run'>('generate');
  const [prompt, setPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  const aiOutputEndRef = useRef<HTMLDivElement>(null);
  const runOutputEndRef = useRef<HTMLDivElement>(null);

  const selectedFile = files?.find((f) => f.id === selectedFileId);

  useEffect(() => {
    if (selectedFileId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedFileId;
      setEditorContent(selectedFile?.content ?? '');
    }
  }, [selectedFileId, selectedFile]);

  useEffect(() => {
    aiOutputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiOutput]);

  useEffect(() => {
    runOutputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runOutput]);

  const tree = files ? buildTree(files) : null;
  const isDirty = selectedFile && editorContent !== selectedFile.content;

  const handleSave = () => {
    if (!selectedFile || !isDirty) return;
    updateFileMutation.mutate(
      { id: projId, fileId: selectedFile.id, data: { content: editorContent } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projId) });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setAiOutput('');
    try {
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/api/projects/${projId}/generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      await parseSSE<{ content?: string; done?: boolean }>(
        res,
        (data) => { if (data.content) setAiOutput((p) => p + data.content); },
        () => {
          setIsProcessing(false);
          setPrompt('');
          queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projId) });
        },
        (err) => { console.error(err); setIsProcessing(false); },
      );
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const handleDebug = async () => {
    if (!prompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setAiOutput('');
    try {
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/api/projects/${projId}/debug`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: prompt, fileId: selectedFileId || undefined }),
      });
      await parseSSE<{ content?: string; done?: boolean }>(
        res,
        (data) => { if (data.content) setAiOutput((p) => p + data.content); },
        () => { setIsProcessing(false); setPrompt(''); },
        (err) => { console.error(err); setIsProcessing(false); },
      );
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const handleRun = async () => {
    if (isRunning || isProcessing) return;
    setIsRunning(true);
    setRunOutput('');
    setActiveTab('run');
    try {
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/api/projects/${projId}/run`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedFileId ? { entryFile: selectedFile?.path } : {}),
      });
      await parseSSE<{ content?: string; done?: boolean }>(
        res,
        (data) => { if (data.content) setRunOutput((p) => p + data.content); },
        () => { setIsRunning(false); },
        (err) => { console.error(err); setIsRunning(false); },
      );
    } catch (e) {
      console.error(e);
      setIsRunning(false);
    }
  };

  const langColor = selectedFile ? (LANG_COLORS[selectedFile.language] ?? 'text-muted-foreground') : '';

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-11 border-b border-border flex items-center justify-between px-4 shrink-0 bg-[hsl(220,13%,9%)]">
        <div className="flex items-center gap-2.5">
          <Link href="/projects">
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,16%)] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </Link>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-medium text-foreground">{project?.name ?? 'Workspace'}</span>
          {project && (
            <span className="text-[11px] font-mono text-muted-foreground bg-[hsl(220,13%,16%)] border border-[hsl(220,13%,22%)] px-2 py-0.5 rounded-md">
              {project.framework}
            </span>
          )}
          {project?.status === 'scaffolding' && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              Scaffolding…
            </span>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning || isProcessing || !files?.length}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            isRunning
              ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10 cursor-not-allowed'
              : files?.length
                ? 'text-foreground border-[hsl(220,13%,24%)] bg-[hsl(220,13%,16%)] hover:bg-[hsl(220,13%,20%)] hover:border-[hsl(220,13%,30%)]'
                : 'text-muted-foreground/40 border-border/40 cursor-not-allowed',
          )}
        >
          {isRunning
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Play className="w-3.5 h-3.5" />
          }
          {isRunning ? 'Running…' : 'Run'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── File tree ───────────────────────────────────────────────────── */}
        <div className="w-52 border-r border-border bg-[hsl(220,13%,8%)] flex flex-col shrink-0">
          <div className="px-3 py-2 flex items-center justify-between border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Explorer
            </span>
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              {files?.length ?? 0} files
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {tree
              ? (Object.values(tree.children) as any[]).map((child) => (
                  <FileTreeNode
                    key={child.name}
                    node={child}
                    level={0}
                    selectedId={selectedFileId}
                    onSelect={(node) => setSelectedFileId(node.id)}
                  />
                ))
              : (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                </div>
              )
            }
          </div>
        </div>

        {/* ── Editor ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-[hsl(220,13%,9%)] overflow-hidden">
          {selectedFile ? (
            <>
              {/* Tab bar */}
              <div className="h-9 flex items-center border-b border-border bg-[hsl(220,13%,10%)] shrink-0">
                <div className="flex items-center gap-2 px-4 h-full border-r border-border bg-[hsl(220,13%,9%)] text-[12.5px] font-mono text-foreground border-t-2 border-t-[hsl(258,90%,66%,0.7)]">
                  <FileCode className={cn('w-3.5 h-3.5', langColor)} />
                  <span>{selectedFile.path.split('/').pop()}</span>
                  {isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(258,90%,66%)] ml-0.5" />
                  )}
                </div>
                <div className="flex-1" />
                <button
                  onClick={handleSave}
                  disabled={!isDirty || updateFileMutation.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 mr-2 rounded-md text-xs transition-colors',
                    isDirty
                      ? 'text-foreground hover:bg-[hsl(220,13%,18%)]'
                      : 'text-muted-foreground/30 cursor-not-allowed',
                  )}
                >
                  {saved ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Saved</span></>
                  ) : updateFileMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Saving…</span></>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /><span>Save</span></>
                  )}
                </button>
              </div>

              {/* Code area */}
              <div className="flex-1 overflow-auto">
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="w-full h-full bg-transparent text-[hsl(210,17%,88%)] font-mono text-[13px] leading-[1.7] p-5 resize-none focus:outline-none whitespace-pre"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
              <FileCode className="w-10 h-10 opacity-10" />
              <p className="text-sm text-muted-foreground/60">Select a file to edit</p>
            </div>
          )}
        </div>

        {/* ── AI panel ────────────────────────────────────────────────────── */}
        <div className="w-[300px] border-l border-border bg-[hsl(220,13%,10%)] flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {(['generate', 'debug', 'run'] as const).map((tab) => {
              const icons = { generate: Sparkles, debug: Bug, run: Terminal };
              const Icon = icons[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                    activeTab === tab
                      ? 'text-foreground border-b-2 border-[hsl(258,90%,66%)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Output area */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activeTab === 'run' ? (
              runOutput ? (
                <div className="font-mono text-[12px] leading-relaxed">
                  <pre className="text-emerald-400 whitespace-pre-wrap">
                    {runOutput}
                    {isRunning && <span className="cursor-blink text-muted-foreground">▌</span>}
                  </pre>
                  <div ref={runOutputEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center text-muted-foreground py-8">
                  {isRunning ? (
                    <>
                      <Loader2 className="w-7 h-7 opacity-20 animate-spin" />
                      <p className="text-xs">Starting simulation…</p>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-7 h-7 opacity-15" />
                      <p className="text-xs">Press Run to simulate execution</p>
                    </>
                  )}
                </div>
              )
            ) : aiOutput ? (
              <div className="text-[13px]">
                {activeTab === 'generate' ? (
                  <>
                    <pre className="font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed text-[12px]">
                      {aiOutput}
                    </pre>
                    <div ref={aiOutputEndRef} />
                  </>
                ) : (
                  <>
                    <div className="prose prose-sm prose-chat max-w-none text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiOutput}</ReactMarkdown>
                    </div>
                    <div ref={aiOutputEndRef} />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center text-muted-foreground py-8">
                {activeTab === 'generate' ? (
                  <>
                    <Sparkles className="w-7 h-7 opacity-15" />
                    <p className="text-xs">Describe what to generate or modify</p>
                  </>
                ) : (
                  <>
                    <Bug className="w-7 h-7 opacity-15" />
                    <p className="text-xs">Paste an error or describe the issue</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Clear output button — shown when there's output */}
          {(aiOutput || runOutput) && (
            <div className="px-3 pb-1 shrink-0">
              <button
                onClick={() => { setAiOutput(''); setRunOutput(''); }}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Clear output
              </button>
            </div>
          )}

          {/* Input — hidden on Run tab */}
          <div className={cn('p-3 border-t border-border shrink-0', activeTab === 'run' && 'hidden')}>
            <div className={cn(
              'relative bg-[hsl(220,13%,14%)] border rounded-xl transition-all',
              'border-[hsl(220,13%,22%)] focus-within:border-[hsl(258,90%,66%,0.4)]',
            )}>
              <textarea
                placeholder={
                  activeTab === 'generate'
                    ? 'Add a User model and auth routes…'
                    : 'Paste error log or describe the issue…'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    activeTab === 'generate' ? handleGenerate() : handleDebug();
                  }
                }}
                rows={3}
                className="w-full px-3 pt-3 pb-10 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed"
              />
              <button
                onClick={activeTab === 'generate' ? handleGenerate : handleDebug}
                disabled={!prompt.trim() || isProcessing}
                className={cn(
                  'absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  prompt.trim() && !isProcessing
                    ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)]'
                    : 'bg-[hsl(220,13%,20%)] text-muted-foreground cursor-not-allowed',
                )}
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : activeTab === 'generate' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <Bug className="w-3.5 h-3.5" />
                )}
                {activeTab === 'generate' ? 'Generate' : 'Analyze'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
