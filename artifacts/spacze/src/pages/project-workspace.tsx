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
  const indent = level * 12 + 8;

  if (isFile) {
    return (
      <button
        className={cn(
          'w-full flex items-center gap-2 py-1 text-[13px] font-mono rounded-md transition-colors text-left',
          selectedId === node.id
            ? 'bg-[hsl(0,0%,22%)] text-foreground'
            : 'text-muted-foreground hover:bg-[hsl(0,0%,18%)] hover:text-foreground'
        )}
        style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
        onClick={() => onSelect(node)}
      >
        <FileCode className="w-3.5 h-3.5 shrink-0 opacity-60" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-2 py-1 text-[13px] font-mono text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,18%)] rounded-md transition-colors text-left"
        style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
        )}
        {expanded ? (
          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
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
  const { data: files } = useListProjectFiles(projId, {
    query: { enabled: !!projId, queryKey: getListProjectFilesQueryKey(projId) },
  });

  const updateFileMutation = useUpdateProjectFile();

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  // Track editor content separately; only sync from server when the selected file changes
  const [editorContent, setEditorContent] = useState('');
  const prevSelectedIdRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'generate' | 'debug' | 'run'>('generate');
  const [prompt, setPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedFile = files?.find((f) => f.id === selectedFileId);

  // Only overwrite editor content when the selected file actually changes
  useEffect(() => {
    if (selectedFileId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedFileId;
      setEditorContent(selectedFile?.content ?? '');
    }
  }, [selectedFileId, selectedFile]);

  const tree = files ? buildTree(files) : null;
  const isDirty = selectedFile && editorContent !== selectedFile.content;

  const handleSave = () => {
    if (!selectedFile || !isDirty) return;
    updateFileMutation.mutate(
      {
        id: projId,
        fileId: selectedFile.id,
        data: { content: editorContent },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projId) });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
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
        (err) => { console.error(err); setIsProcessing(false); }
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
        (err) => { console.error(err); setIsProcessing(false); }
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
        (err) => { console.error(err); setIsRunning(false); }
      );
    } catch (e) {
      console.error(e);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-[hsl(0,0%,12%)]">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,20%)] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <span className="text-sm font-medium text-foreground">{project?.name ?? 'Workspace'}</span>
          {project && (
            <span className="text-[11px] font-mono text-muted-foreground bg-[hsl(0,0%,20%)] px-2 py-0.5 rounded-md">
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
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
            isRunning
              ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10 cursor-not-allowed'
              : files?.length
              ? 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,20%)] border-border'
              : 'text-muted-foreground/40 border-border/40 cursor-not-allowed'
          )}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Running…' : 'Run'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-56 border-r border-border bg-[hsl(0,0%,11%)] flex flex-col shrink-0">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 border-b border-border">
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto py-1 px-1">
            {tree &&
              (Object.values(tree.children) as any[]).map((child) => (
                <FileTreeNode
                  key={child.name}
                  node={child}
                  level={0}
                  selectedId={selectedFileId}
                  onSelect={(node) => setSelectedFileId(node.id)}
                />
              ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col bg-[hsl(0,0%,10%)] overflow-hidden">
          {selectedFile ? (
            <>
              {/* Tab bar */}
              <div className="h-9 flex items-center border-b border-border bg-[hsl(0,0%,12%)] shrink-0">
                <div className="flex items-center gap-2 px-4 h-full border-r border-border bg-[hsl(0,0%,10%)] text-[13px] font-mono text-foreground border-t-2 border-t-foreground/60">
                  <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{selectedFile.path.split('/').pop()}</span>
                  {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 ml-1" />}
                </div>
                <div className="flex-1" />
                <button
                  onClick={handleSave}
                  disabled={!isDirty || updateFileMutation.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 mr-2 rounded-md text-xs transition-colors',
                    isDirty
                      ? 'text-foreground hover:bg-[hsl(0,0%,20%)]'
                      : 'text-muted-foreground/40 cursor-not-allowed'
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
                  className="w-full h-full bg-transparent text-[hsl(0,0%,85%)] font-mono text-[13px] leading-relaxed p-4 resize-none focus:outline-none whitespace-pre"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <FileCode className="w-12 h-12 opacity-10" />
              <p className="text-sm">Select a file to start editing</p>
            </div>
          )}
        </div>

        {/* AI panel */}
        <div className="w-80 border-l border-border bg-[hsl(0,0%,12%)] flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {(['generate', 'debug', 'run'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                  activeTab === tab
                    ? 'text-foreground border-b-2 border-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'generate' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : tab === 'debug' ? (
                  <Bug className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {tab}
              </button>
            ))}
          </div>

          {/* Output */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activeTab === 'run' ? (
              runOutput ? (
                <pre className="font-mono text-[12px] text-emerald-400 whitespace-pre-wrap leading-relaxed">
                  {runOutput}
                  {isRunning && <span className="animate-pulse">▌</span>}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-muted-foreground py-8">
                  {isRunning ? (
                    <>
                      <Loader2 className="w-8 h-8 opacity-20 animate-spin" />
                      <p className="text-xs">Starting…</p>
                    </>
                  ) : (
                    <>
                      <Play className="w-8 h-8 opacity-20" />
                      <p className="text-xs">Press Run to simulate project execution</p>
                    </>
                  )}
                </div>
              )
            ) : aiOutput ? (
              <div className="text-[13px]">
                {activeTab === 'generate' ? (
                  <pre className="font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed text-[12px]">
                    {aiOutput}
                  </pre>
                ) : (
                  <div className="prose prose-sm prose-chat max-w-none text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiOutput}</ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-muted-foreground py-8">
                {activeTab === 'generate' ? (
                  <>
                    <Sparkles className="w-8 h-8 opacity-20" />
                    <p className="text-xs">Describe what to generate or modify</p>
                  </>
                ) : (
                  <>
                    <Bug className="w-8 h-8 opacity-20" />
                    <p className="text-xs">Paste an error or describe the issue</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Input — hidden on the Run tab */}
          <div className={cn('p-3 border-t border-border shrink-0', activeTab === 'run' && 'hidden')}>
            <div className="relative bg-[hsl(0,0%,16%)] border border-border rounded-xl focus-within:border-[hsl(0,0%,30%)] transition-colors">
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
                className="w-full px-3 pt-3 pb-10 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
              />
              <button
                onClick={activeTab === 'generate' ? handleGenerate : handleDebug}
                disabled={!prompt.trim() || isProcessing}
                className={cn(
                  'absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  prompt.trim() && !isProcessing
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'bg-[hsl(0,0%,22%)] text-muted-foreground cursor-not-allowed'
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
