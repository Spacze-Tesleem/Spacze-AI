import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { 
  useGetProject,
  getGetProjectQueryKey,
  useListProjectFiles,
  getListProjectFilesQueryKey,
  useUpdateProjectFile
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  FileCode, 
  Folder, 
  Terminal, 
  Play, 
  Bug, 
  Sparkles,
  ArrowLeft,
  Save,
  Loader2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper to build tree
function buildTree(files: any[]) {
  const root: any = { name: 'root', type: 'folder', children: {}, path: '' };
  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current.children[part] = { ...file, name: part, type: 'file' };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, type: 'folder', children: {}, path: parts.slice(0, i+1).join('/') };
        }
        current = current.children[part];
      }
    }
  });
  return root;
}

function FileTreeNode({ node, level, selectedId, onSelect }: any) {
  const [expanded, setExpanded] = useState(level < 2);
  const isFile = node.type === 'file';
  
  if (isFile) {
    return (
      <div 
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm font-mono rounded-sm transition-colors ${
          selectedId === node.id ? 'bg-primary/20 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        <FileCode className="w-3.5 h-3.5" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div 
        className="flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm font-mono hover:bg-accent text-foreground rounded-sm"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
        <Folder className="w-3.5 h-3.5 text-primary/70" />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && Object.values(node.children).sort((a: any, b: any) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      }).map((child: any) => (
        <FileTreeNode key={child.name} node={child} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams();
  const projId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projId, {
    query: { enabled: !!projId, queryKey: getGetProjectQueryKey(projId) }
  });
  
  const { data: files } = useListProjectFiles(projId, {
    query: { enabled: !!projId, queryKey: getListProjectFilesQueryKey(projId) }
  });

  const updateFileMutation = useUpdateProjectFile();

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState('');
  
  // AI Panel state
  const [activeTab, setActiveTab] = useState<'generate' | 'debug'>('generate');
  const [prompt, setPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedFile = files?.find(f => f.id === selectedFileId);

  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content);
    } else {
      setEditorContent('');
    }
  }, [selectedFileId, selectedFile]);

  const tree = files ? buildTree(files) : null;

  const handleSave = () => {
    if (!selectedFile) return;
    updateFileMutation.mutate({ 
      id: selectedFile.id, 
      data: { content: editorContent } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projId) });
      }
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setAiOutput('');

    try {
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/projects/${projId}/generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      await parseSSE<{content?: string, done?: boolean}>(
        res,
        (data) => {
          if (data.content) {
            setAiOutput(prev => prev + data.content + '\n');
          }
        },
        () => {
          setIsProcessing(false);
          setPrompt('');
          queryClient.invalidateQueries({ queryKey: getListProjectFilesQueryKey(projId) });
        },
        (err) => {
          console.error(err);
          setIsProcessing(false);
        }
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
      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/projects/${projId}/debug`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: prompt, fileId: selectedFileId || undefined })
      });

      await parseSSE<{content?: string, done?: boolean}>(
        res,
        (data) => {
          if (data.content) {
            setAiOutput(prev => prev + data.content);
          }
        },
        () => {
          setIsProcessing(false);
          setPrompt('');
        },
        (err) => {
          console.error(err);
          setIsProcessing(false);
        }
      );
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Nav */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="w-8 h-8">
            <Link href="/projects">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="font-semibold">{project?.name || 'Workspace'}</div>
          {project && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase ml-2 bg-primary/10 text-primary border-primary/20">
              {project.framework}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project?.status === 'scaffolding' && (
            <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <Loader2 className="w-3 h-3 animate-spin" /> Scaffolding...
            </div>
          )}
          <Button size="sm" variant="outline" className="gap-2">
            <Play className="w-3.5 h-3.5" /> Run
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Tree */}
        <div className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
          <div className="p-3 font-semibold text-sm border-b border-border flex justify-between items-center text-sidebar-foreground">
            <span>EXPLORER</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {tree && Object.values(tree.children).map((child: any) => (
              <FileTreeNode 
                key={child.name} 
                node={child} 
                level={0} 
                selectedId={selectedFileId} 
                onSelect={(node: any) => setSelectedFileId(node.id)} 
              />
            ))}
          </div>
        </div>

        {/* Center - Editor */}
        <div className="flex-1 flex flex-col bg-[#0d1117] relative">
          {selectedFile ? (
            <>
              <div className="h-10 bg-[#0d1117] flex items-center border-b border-[#30363d]">
                <div className="h-full px-4 border-r border-[#30363d] bg-[#161b22] text-[#c9d1d9] flex items-center gap-2 text-sm font-mono border-t-2 border-t-primary">
                  <FileCode className="w-4 h-4 text-primary" />
                  {selectedFile.path.split('/').pop()}
                </div>
                <div className="flex-1 flex justify-end px-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleSave}
                    disabled={editorContent === selectedFile.content || updateFileMutation.isPending}
                    className={`h-7 px-2 text-xs gap-1.5 ${editorContent !== selectedFile.content ? 'text-primary hover:text-primary hover:bg-primary/20' : 'text-muted-foreground'}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="w-full h-full bg-transparent text-[#c9d1d9] font-mono text-[13px] leading-relaxed p-4 resize-none focus:outline-none focus:ring-0 whitespace-pre spellcheck-false"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Terminal className="w-16 h-16 opacity-10 mb-4" />
              <p>Select a file to start editing</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - AI Panel */}
        <div className="w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="flex border-b border-border">
            <button 
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 ${activeTab === 'generate' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-accent'}`}
              onClick={() => setActiveTab('generate')}
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate
            </button>
            <button 
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 ${activeTab === 'debug' ? 'text-destructive border-b-2 border-destructive bg-destructive/5' : 'text-muted-foreground hover:bg-accent'}`}
              onClick={() => setActiveTab('debug')}
            >
              <Bug className="w-3.5 h-3.5" /> Debug
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {aiOutput && (
              <div className="bg-background rounded-lg border border-border p-3 flex-1 overflow-y-auto min-h-[200px]">
                <div className="prose prose-sm prose-invert max-w-none">
                  {activeTab === 'generate' ? (
                    <div className="font-mono text-xs text-primary whitespace-pre-wrap">{aiOutput}</div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiOutput}</ReactMarkdown>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-auto space-y-3">
              <div className="space-y-2">
                <Textarea
                  placeholder={activeTab === 'generate' ? "E.g., Create a User model and auth router..." : "Paste error log or describe the issue..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] resize-none text-sm font-mono bg-background border-border"
                />
              </div>
              <Button 
                onClick={activeTab === 'generate' ? handleGenerate : handleDebug}
                disabled={!prompt.trim() || isProcessing}
                className={`w-full ${activeTab === 'debug' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : activeTab === 'generate' ? (
                  <Sparkles className="w-4 h-4 mr-2" />
                ) : (
                  <Bug className="w-4 h-4 mr-2" />
                )}
                {activeTab === 'generate' ? 'Generate Code' : 'Analyze Issue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
