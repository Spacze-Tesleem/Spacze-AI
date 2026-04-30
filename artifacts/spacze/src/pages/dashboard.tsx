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
  Sparkles,
  FolderGit2,
  MessageSquare,
  Activity,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  Mic,
  Code2,
  Zap,
  Globe,
  Image,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  { label: 'Scaffold a React app', icon: Code2, hint: 'Vite + TypeScript' },
  { label: 'Debug my code',        icon: Zap,   hint: 'Paste an error' },
  { label: 'Explain architecture', icon: Globe, hint: 'System design' },
  { label: 'Generate an image',    icon: Image, hint: 'AI art' },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: stats, isLoading: statsLoading } = useGetProjectStats();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (conv: { id: number }) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${conv.id}?q=${encodeURIComponent(input.trim())}`);
      },
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || isCreating) return;
    setIsCreating(true);
    const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
    createMutation.mutate({ data: { title } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !isCreating;

  const statCards = [
    {
      label: 'Total projects',
      value: statsLoading ? null : (stats as any)?.total ?? 0,
      icon: FolderGit2,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Ready',
      value: statsLoading ? null : (stats as any)?.byStatus?.ready ?? 0,
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Frameworks',
      value: statsLoading
        ? null
        : Object.keys((stats as any)?.byFramework ?? {}).length,
      icon: Terminal,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
  ];

  const recentProjects: any[] = (stats as any)?.recentProjects ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-16 pb-12">
        <div className="w-full max-w-2xl space-y-10">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="text-center space-y-3 select-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(258,90%,66%,0.1)] border border-[hsl(258,90%,66%,0.2)] text-[hsl(258,90%,78%)] text-xs font-medium mb-2">
              <Sparkles className="w-3 h-3" />
              Spacze AI
            </div>
            <h1 className="text-4xl font-semibold text-foreground tracking-tight leading-tight">
              What do you want to build?
            </h1>
            <p className="text-base text-muted-foreground">
              Describe your idea and the AI will scaffold, debug, and run it.
            </p>
          </div>

          {/* ── Composer ──────────────────────────────────────────────────── */}
          <div className="w-full">
            <div
              className={cn(
                'rounded-2xl border bg-[hsl(220,13%,12%)] transition-all duration-200',
                'border-[hsl(220,13%,20%)]',
                'composer-glow',
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Spacze AI to…"
                rows={3}
                disabled={isCreating}
                className={cn(
                  'w-full bg-transparent text-foreground text-[15px] leading-relaxed',
                  'placeholder:text-muted-foreground/60 resize-none focus:outline-none',
                  'px-5 pt-5 pb-3 min-h-[88px] max-h-[200px] overflow-y-auto',
                )}
              />

              <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-3">
                {/* Left: model pill */}
                <button
                  disabled
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[hsl(220,13%,22%)] text-muted-foreground bg-[hsl(220,13%,15%)] cursor-default"
                >
                  <div className="w-3.5 h-3.5 rounded-sm brand-gradient flex items-center justify-center">
                    <Sparkles className="w-2 h-2 text-white" />
                  </div>
                  Spacze AI
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>

                {/* Right: send */}
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                    canSend
                      ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)] shadow-lg shadow-[hsl(258,90%,66%,0.3)]'
                      : 'bg-[hsl(220,13%,18%)] text-muted-foreground cursor-not-allowed',
                  )}
                >
                  {isCreating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : canSend
                      ? <ArrowUp className="w-4 h-4" />
                      : <Mic className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50 mt-2.5">
              <kbd className="font-mono">Enter</kbd> to send ·{' '}
              <kbd className="font-mono">Shift+Enter</kbd> for new line
            </p>
          </div>

          {/* ── Suggestion chips ──────────────────────────────────────────── */}
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map(({ label, icon: Icon, hint }) => (
              <button
                key={label}
                onClick={() => { setInput(label); textareaRef.current?.focus(); }}
                disabled={isCreating}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm',
                  'bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] text-muted-foreground',
                  'hover:border-[hsl(258,90%,66%,0.35)] hover:text-foreground hover:bg-[hsl(220,13%,15%)]',
                  'transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="flex flex-col gap-3 p-4 rounded-2xl bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)]"
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
                <div>
                  {value === null ? (
                    <Skeleton className="h-6 w-10 mb-1" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/projects/new">
              <div className="group flex items-center gap-3 p-4 rounded-2xl bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(258,90%,66%,0.3)] hover:bg-[hsl(220,13%,14%)] transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">New project</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI scaffolding</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            <Link href="/chat">
              <div className="group flex items-center gap-3 p-4 rounded-2xl bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(258,90%,66%,0.3)] hover:bg-[hsl(220,13%,14%)] transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">All chats</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Browse history</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          </div>

          {/* ── Recent projects ───────────────────────────────────────────── */}
          {(statsLoading || recentProjects.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Recent projects</h2>
                <Link href="/projects">
                  <span className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>

              {statsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentProjects.map((project: any) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(258,90%,66%,0.25)] hover:bg-[hsl(220,13%,14%)] transition-all cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(220,13%,18%)] flex items-center justify-center shrink-0">
                          <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{project.framework}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(project.updatedAt), 'MMM d')}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
