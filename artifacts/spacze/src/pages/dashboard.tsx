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
  Mic,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'Agent' | 'Plan';
type ActiveTool = 'web' | 'code' | 'image';

const SUGGESTIONS = [
  { label: 'Scaffold a React app', icon: Code2 },
  { label: 'Debug my code',        icon: Zap },
  { label: 'Explain an architecture', icon: Globe },
  { label: 'Generate an image',    icon: Image },
];

const QUICK_ACTIONS = [
  'Explain this code',
  'Write unit tests for this',
  'Refactor for readability',
  'Find bugs in this code',
  'Add TypeScript types',
  'Write a README',
];

function buildSystemModifiers(mode: Mode, activeTools: Set<ActiveTool>): string {
  const parts: string[] = [];
  if (mode === 'Plan') parts.push('Respond with a concise step-by-step plan only. Do NOT write any code.');
  if (activeTools.has('web')) parts.push('The user wants you to search the web for up-to-date information before answering.');
  if (activeTools.has('code')) parts.push('Focus exclusively on code. Return code blocks with the language specified. Minimise prose.');
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
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
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
        if (tool === 'image') { next.clear(); setGeneratedImage(null); setImageError(null); }
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

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(0,0%,12%)]">
      <div className="max-w-[680px] mx-auto px-5 pt-16 pb-12 flex flex-col gap-8">

        {/* ── Hero ── */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-[52px] h-[52px] rounded-2xl bg-white flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-[hsl(0,0%,10%)]" />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold text-white tracking-tight leading-tight">
              What do you want to build?
            </h1>
            <p className="mt-1.5 text-[15px] text-[hsl(0,0%,55%)]">
              Scaffold projects, debug code, or just have a conversation.
            </p>
          </div>
        </div>

        {/* ── Composer ── */}
        <div className="relative">
          {/* Quick actions popover */}
          {showQuickActions && (
            <div
              ref={quickActionsRef}
              className="absolute bottom-full mb-2 left-0 z-50 w-60 bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,22%)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <p className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,40%)] border-b border-[hsl(0,0%,18%)]">
                Quick actions
              </p>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => { setInput(action); setShowQuickActions(false); textareaRef.current?.focus(); }}
                  className="w-full text-left px-3.5 py-2.5 text-[13px] text-[hsl(0,0%,65%)] hover:bg-[hsl(0,0%,18%)] hover:text-white transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* v0-style composer box */}
          <div className={cn(
            'rounded-2xl border bg-[hsl(0,0%,14%)] transition-all duration-150',
            isImageMode
              ? 'border-amber-500/30'
              : 'border-[hsl(0,0%,20%)] focus-within:border-[hsl(0,0%,30%)]',
          )}>
            {/* Textarea — open, no inner chrome */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isImageMode ? 'Describe the image you want to generate…' : 'Ask Spacze AI to build…'}
              rows={3}
              disabled={isCreating || isGeneratingImage}
              className="w-full bg-transparent text-[15px] text-white leading-relaxed placeholder:text-[hsl(0,0%,38%)] resize-none focus:outline-none px-4 pt-4 pb-3 min-h-[96px] max-h-[200px] overflow-y-auto"
            />

            {/* Bottom toolbar — v0 layout */}
            <div className="flex items-center gap-2 px-3 pb-3">
              {/* + attach */}
              <button
                title="Attach file (coming soon)"
                disabled
                className="p-1.5 rounded-lg text-[hsl(0,0%,45%)] opacity-50 cursor-not-allowed"
              >
                <Plus className="w-[18px] h-[18px]" />
              </button>

              {/* Model selector pill */}
              <button
                onClick={() => setMode(m => m === 'Agent' ? 'Plan' : 'Agent')}
                disabled={isCreating || isImageMode}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors border',
                  mode === 'Plan'
                    ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
                    : 'border-[hsl(0,0%,24%)] text-[hsl(0,0%,65%)] hover:border-[hsl(0,0%,34%)] hover:text-white bg-[hsl(0,0%,18%)]',
                  (isCreating || isImageMode) && 'opacity-40 cursor-not-allowed',
                )}
              >
                <div className="w-4 h-4 rounded-sm bg-[hsl(0,0%,30%)] flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
                Spacze {mode}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {/* Tool toggles */}
              {[
                { key: 'web',   icon: Globe,  label: 'Web',   tool: 'web'   as ActiveTool, disabled: isImageMode },
                { key: 'image', icon: Image,  label: 'Image', tool: 'image' as ActiveTool, disabled: false },
                { key: 'code',  icon: Code2,  label: 'Code',  tool: 'code'  as ActiveTool, disabled: isImageMode },
              ].map(({ key, icon: Icon, label, tool, disabled }) => (
                <button
                  key={key}
                  title={label}
                  disabled={disabled || isCreating || isGeneratingImage}
                  onClick={() => toggleTool(tool)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors border',
                    activeTools.has(tool)
                      ? 'border-[hsl(0,0%,38%)] text-white bg-[hsl(0,0%,24%)]'
                      : 'border-transparent text-[hsl(0,0%,45%)] hover:text-white hover:bg-[hsl(0,0%,20%)]',
                    (disabled || isCreating || isGeneratingImage) && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Project context selector */}
              <Link href="/projects">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-[hsl(0,0%,55%)] border border-[hsl(0,0%,22%)] hover:border-[hsl(0,0%,32%)] hover:text-white bg-[hsl(0,0%,18%)] transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Project
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
              </Link>

              {/* Send / mic button */}
              <button
                onClick={isImageMode ? handleGenerateImage : handleSend}
                disabled={!canSend}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  canSend
                    ? isImageMode
                      ? 'bg-amber-500 text-white hover:bg-amber-400'
                      : 'bg-white text-[hsl(0,0%,8%)] hover:bg-[hsl(0,0%,88%)]'
                    : 'bg-[hsl(0,0%,20%)] text-[hsl(0,0%,38%)] cursor-not-allowed',
                )}
              >
                {isCreating || isGeneratingImage
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : input.trim()
                    ? <ArrowUp className="w-4 h-4" />
                    : <Mic className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[hsl(0,0%,35%)] mt-2">
            Press <kbd className="font-mono">Enter</kbd> to send ·{' '}
            <kbd className="font-mono">Shift+Enter</kbd> for new line
          </p>
        </div>

        {/* ── Image result ── */}
        {isImageMode && (isGeneratingImage || generatedImage || imageError) && (
          <div className="rounded-2xl border border-amber-500/20 bg-[hsl(0,0%,15%)] overflow-hidden">
            {isGeneratingImage && (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-[hsl(0,0%,50%)]">
                <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                <p className="text-sm">Generating image…</p>
              </div>
            )}
            {imageError && !isGeneratingImage && (
              <div className="flex items-center justify-between px-4 py-3 text-sm text-red-400">
                <span>{imageError}</span>
                <button onClick={() => setImageError(null)} className="p-1 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {generatedImage && !isGeneratingImage && (
              <>
                <img src={`data:image/png;base64,${generatedImage}`} alt={imagePrompt} className="w-full object-contain max-h-[480px]" />
                <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(0,0%,20%)]">
                  <p className="text-xs text-[hsl(0,0%,50%)] truncate flex-1 mr-4">{imagePrompt}</p>
                  <a href={`data:image/png;base64,${generatedImage}`} download="spacze-image.png" className="text-xs text-[hsl(0,0%,50%)] hover:text-white transition-colors shrink-0">
                    Download
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Suggestion chips ── */}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => handleSuggestion(label)}
              disabled={isCreating || isGeneratingImage}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-[hsl(0,0%,65%)] bg-[hsl(0,0%,17%)] border border-[hsl(0,0%,24%)] hover:border-[hsl(0,0%,36%)] hover:text-white hover:bg-[hsl(0,0%,20%)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-[hsl(0,0%,20%)]" />

        {/* ── Scaffold shortcut ── */}
        <Link href="/projects/new">
          <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,22%)] hover:border-[hsl(0,0%,32%)] hover:bg-[hsl(0,0%,18%)] transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[hsl(0,0%,22%)] group-hover:bg-[hsl(0,0%,26%)] flex items-center justify-center shrink-0 transition-colors">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-[14px]">Scaffold a project</p>
              <p className="text-[12px] text-[hsl(0,0%,50%)] mt-0.5">Generate a full project from a prompt</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[hsl(0,0%,45%)] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total projects', value: isLoading ? null : (stats?.total ?? 0),                              icon: FolderGit2,  highlight: false },
            { label: 'Frameworks',     value: isLoading ? null : Object.keys(stats?.byFramework ?? {}).length,     icon: Terminal,    highlight: false },
            { label: 'Status',         value: 'Online',                                                             icon: Activity,    highlight: true  },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div key={label} className="p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,22%)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-[hsl(0,0%,50%)] font-medium">{label}</p>
                <Icon className={cn('w-4 h-4', highlight ? 'text-emerald-400' : 'text-[hsl(0,0%,40%)]')} />
              </div>
              {value === null
                ? <Skeleton className="h-7 w-10 bg-[hsl(0,0%,22%)]" />
                : <p className={cn('text-[22px] font-semibold leading-none', highlight ? 'text-emerald-400' : 'text-white')}>{value}</p>
              }
            </div>
          ))}
        </div>

        {/* ── Recent projects ── */}
        {(isLoading || (stats?.recentProjects && stats.recentProjects.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-semibold text-[hsl(0,0%,70%)] uppercase tracking-wider">Recent projects</h2>
              <Link href="/projects">
                <span className="text-[12px] text-[hsl(0,0%,45%)] hover:text-white transition-colors cursor-pointer">View all</span>
              </Link>
            </div>
            <div className="space-y-0.5">
              {isLoading
                ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl bg-[hsl(0,0%,18%)]" />)
                : stats?.recentProjects?.slice(0, 5).map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[hsl(0,0%,18%)] transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(0,0%,20%)] flex items-center justify-center shrink-0">
                          <FolderGit2 className="w-3.5 h-3.5 text-[hsl(0,0%,55%)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{project.name}</p>
                          <p className="text-[11px] text-[hsl(0,0%,45%)] flex items-center gap-1 mt-0.5">
                            <span className="font-mono">{project.framework}</span>
                            <span>·</span>
                            <Clock className="w-3 h-3" />
                            {format(new Date(project.updatedAt), 'MMM d')}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[hsl(0,0%,40%)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
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
