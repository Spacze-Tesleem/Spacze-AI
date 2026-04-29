import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import {
  useCreateOpenaiConversation,
  useGetProjectStats,
  getListOpenaiConversationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  ArrowUp,
  Paperclip,
  Zap,
  Globe,
  Image,
  Code2,
  Play,
  Sparkles,
  ChevronDown,
  FolderGit2,
  Terminal,
  Activity,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'Agent' | 'Plan';
type ActiveTool = 'web' | 'code' | 'image';

const QUICK_ACTIONS = [
  'Explain this code',
  'Write unit tests for this',
  'Refactor for readability',
  'Find bugs in this code',
  'Add TypeScript types',
  'Write a README',
];

const SUGGESTIONS = [
  { label: 'Scaffold a React app', icon: Code2 },
  { label: 'Debug my code', icon: Zap },
  { label: 'Explain an architecture', icon: Globe },
  { label: 'Generate an image', icon: Image },
];

function buildSystemModifiers(mode: Mode, activeTools: Set<ActiveTool>): string {
  const parts: string[] = [];
  if (mode === 'Plan') {
    parts.push('Respond with a concise step-by-step plan only. Do NOT write any code.');
  }
  if (activeTools.has('web')) {
    parts.push('The user wants you to search the web for up-to-date information before answering.');
  }
  if (activeTools.has('code')) {
    parts.push('Focus exclusively on code. Return code blocks with the language specified. Minimise prose.');
  }
  return parts.join(' ');
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useGetProjectStats();

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('Agent');
  const [activeTools, setActiveTools] = useState<Set<ActiveTool>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const isImageMode = activeTools.has('image');

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [input]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setShowQuickActions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleTool(tool: ActiveTool) {
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        if (tool === 'image') {
          next.clear();
          setGeneratedImage(null);
          setImageError(null);
        }
        next.add(tool);
      }
      return next;
    });
  }

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (conv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        const modifiers = buildSystemModifiers(mode, activeTools);
        const text = input.trim();
        const payload = modifiers
          ? encodeURIComponent(`[SYSTEM_HINT:${modifiers}]\n${text}`)
          : encodeURIComponent(text);
        setLocation(`/chat/${conv.id}?q=${payload}`);
      },
    },
  });

  const sendChat = (text: string) => {
    if (!text.trim() || isCreating) return;
    setIsCreating(true);
    const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
    createMutation.mutate({ data: { title } });
  };

  const handleSend = () => sendChat(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      isImageMode ? handleGenerateImage() : handleSend();
    }
  };

  const handleGenerateImage = async () => {
    const prompt = input.trim();
    if (!prompt || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setGeneratedImage(null);
    setImageError(null);
    setImagePrompt(prompt);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
      const res = await fetch(`${base}/api/openai/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size: '1024x1024' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGeneratedImage(data.b64_json);
    } catch {
      setImageError('Image generation failed. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSuggestion = (label: string) => {
    if (label === 'Generate an image') {
      setActiveTools(new Set(['image']));
      setInput('');
      textareaRef.current?.focus();
      return;
    }
    setInput(label);
    setTimeout(() => sendChat(label), 0);
  };

  const canSend = input.trim().length > 0 && !isCreating && !isGeneratingImage;

  const toolbarButtons = [
    {
      key: 'attach',
      icon: Paperclip,
      label: 'Attach file',
      disabled: true,
      title: 'File attachments coming soon',
      active: false,
      onClick: () => {},
    },
    {
      key: 'quick',
      icon: Zap,
      label: 'Quick actions',
      disabled: false,
      title: 'Quick actions',
      active: showQuickActions,
      onClick: () => setShowQuickActions((v) => !v),
    },
    {
      key: 'web',
      icon: Globe,
      label: 'Web search',
      disabled: isImageMode,
      title: activeTools.has('web') ? 'Web search: on (click to disable)' : 'Web search: off (click to enable)',
      active: activeTools.has('web'),
      onClick: () => toggleTool('web'),
    },
    {
      key: 'image',
      icon: Image,
      label: 'Image mode',
      disabled: false,
      title: activeTools.has('image') ? 'Image mode: on (click to disable)' : 'Generate an image',
      active: activeTools.has('image'),
      onClick: () => toggleTool('image'),
    },
    {
      key: 'code',
      icon: Code2,
      label: 'Code mode',
      disabled: isImageMode,
      title: activeTools.has('code') ? 'Code mode: on (click to disable)' : 'Code mode: off (click to enable)',
      active: activeTools.has('code'),
      onClick: () => toggleTool('code'),
    },
    {
      key: 'run',
      icon: Play,
      label: 'Run',
      disabled: true,
      title: 'Code execution coming soon',
      active: false,
      onClick: () => {},
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-background" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            What do you want to build?
          </h1>
          <p className="text-muted-foreground text-base">
            Scaffold projects, debug code, or just have a conversation.
          </p>
        </div>

        {/* Active mode/tool badges */}
        {(activeTools.size > 0 || mode === 'Plan') && (
          <div className="flex flex-wrap gap-2 justify-center -mb-4">
            {mode === 'Plan' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20">
                <Sparkles className="w-3 h-3" /> Plan mode
              </span>
            )}
            {activeTools.has('web') && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20">
                <Globe className="w-3 h-3" /> Web search
              </span>
            )}
            {activeTools.has('code') && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <Code2 className="w-3 h-3" /> Code mode
              </span>
            )}
            {activeTools.has('image') && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <Image className="w-3 h-3" /> Image mode
              </span>
            )}
          </div>
        )}

        {/* Composer */}
        <div className="relative">
          {/* Quick actions popover */}
          {showQuickActions && (
            <div
              ref={quickActionsRef}
              className="absolute bottom-full mb-2 left-0 z-50 w-64 bg-[hsl(0,0%,14%)] border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border">
                Quick actions
              </p>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    setInput(action);
                    setShowQuickActions(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:bg-[hsl(0,0%,20%)] hover:text-foreground transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          <div
            className={cn(
              'rounded-2xl border bg-[hsl(0,0%,16%)] transition-colors',
              isImageMode
                ? 'border-amber-500/30 focus-within:border-amber-500/50'
                : 'border-[hsl(0,0%,22%)] focus-within:border-[hsl(0,0%,32%)]',
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isImageMode ? 'Describe the image you want to generate…' : 'Ask Spacze AI to…'}
              rows={3}
              disabled={isCreating || isGeneratingImage}
              className={cn(
                'w-full bg-transparent text-foreground text-sm leading-relaxed',
                'placeholder:text-muted-foreground resize-none focus:outline-none',
                'px-4 pt-4 pb-2 min-h-[80px] max-h-[240px] overflow-y-auto',
              )}
            />

            <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
              <div className="flex items-center gap-0.5">
                {toolbarButtons.map(({ key, icon: Icon, disabled, title, active, onClick }) => (
                  <button
                    key={key}
                    title={title}
                    disabled={disabled || isCreating || isGeneratingImage}
                    onClick={onClick}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      active
                        ? 'text-foreground bg-[hsl(0,0%,26%)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,22%)]',
                      (disabled || isCreating || isGeneratingImage) && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isImageMode && (
                  <button
                    onClick={() => setMode((m) => (m === 'Agent' ? 'Plan' : 'Agent'))}
                    disabled={isCreating}
                    title={mode === 'Agent' ? 'Switch to Plan mode — outline only, no code' : 'Switch to Agent mode — full response'}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      mode === 'Plan'
                        ? 'border border-violet-500/40 text-violet-400 bg-violet-500/10'
                        : 'border border-[hsl(0,0%,28%)] text-muted-foreground hover:border-[hsl(0,0%,38%)] hover:text-foreground',
                      isCreating && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {mode}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                )}

                <button
                  onClick={isImageMode ? handleGenerateImage : handleSend}
                  disabled={!canSend}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
                    canSend
                      ? isImageMode
                        ? 'bg-amber-500 text-white hover:bg-amber-400'
                        : 'bg-foreground text-background hover:bg-foreground/85'
                      : 'bg-[hsl(0,0%,24%)] text-muted-foreground cursor-not-allowed',
                  )}
                >
                  {isCreating || isGeneratingImage
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ArrowUp className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-2.5">
            Press <kbd className="font-mono">Enter</kbd> to send ·{' '}
            <kbd className="font-mono">Shift+Enter</kbd> for new line
          </p>
        </div>

        {/* Image generation result */}
        {isImageMode && (isGeneratingImage || generatedImage || imageError) && (
          <div className="rounded-2xl border border-amber-500/20 bg-[hsl(0,0%,14%)] overflow-hidden">
            {isGeneratingImage && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm">Generating image…</p>
              </div>
            )}
            {imageError && !isGeneratingImage && (
              <div className="flex items-center justify-between px-4 py-3 text-sm text-red-400">
                <span>{imageError}</span>
                <button onClick={() => setImageError(null)} className="p-1 hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {generatedImage && !isGeneratingImage && (
              <>
                <img
                  src={`data:image/png;base64,${generatedImage}`}
                  alt={imagePrompt}
                  className="w-full object-contain max-h-[512px]"
                />
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground truncate flex-1 mr-4">{imagePrompt}</p>
                  <a
                    href={`data:image/png;base64,${generatedImage}`}
                    download="spacze-image.png"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    Download
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => handleSuggestion(label)}
              disabled={isCreating || isGeneratingImage}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm',
                'bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,22%)] text-muted-foreground',
                'hover:border-[hsl(0,0%,32%)] hover:text-foreground hover:bg-[hsl(0,0%,19%)]',
                'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Scaffold a project shortcut */}
        <Link href="/projects/new">
          <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-border hover:border-[hsl(0,0%,30%)] hover:bg-[hsl(0,0%,18%)] transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[hsl(0,0%,22%)] flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm">Scaffold a project</p>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a full project from a prompt</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total projects', value: isLoading ? null : stats?.total ?? 0, icon: FolderGit2 },
            { label: 'Frameworks', value: isLoading ? null : Object.keys(stats?.byFramework ?? {}).length, icon: Terminal },
            { label: 'Status', value: 'Online', icon: Activity, highlight: true },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div key={label} className="p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${highlight ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              {value === null
                ? <Skeleton className="h-7 w-12" />
                : <p className={`text-2xl font-semibold ${highlight ? 'text-emerald-400' : 'text-foreground'}`}>{value}</p>
              }
            </div>
          ))}
        </div>

        {/* Recent projects */}
        {(isLoading || (stats?.recentProjects && stats.recentProjects.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent projects</h2>
              <Link href="/projects">
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">View all</span>
              </Link>
            </div>
            <div className="space-y-1">
              {isLoading
                ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
                : stats?.recentProjects?.slice(0, 5).map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[hsl(0,0%,18%)] transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(0,0%,20%)] flex items-center justify-center shrink-0">
                          <FolderGit2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <span className="font-mono">{project.framework}</span>
                            <span>·</span>
                            <Clock className="w-3 h-3" />
                            {format(new Date(project.updatedAt), 'MMM d')}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))
              }
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
