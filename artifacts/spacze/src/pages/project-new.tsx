import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { useCreateProject } from '@workspace/api-client-react';
import { parseSSE } from '@/lib/sse';
import {
  Loader2,
  Sparkles,
  Check,
  ArrowLeft,
  ChevronRight,
  Terminal,
  Code2,
  Globe,
  Zap,
  Server,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FRAMEWORKS = [
  { id: 'react',   name: 'React',    sub: 'Vite + TypeScript', icon: Code2,    color: 'text-sky-400',     bg: 'bg-sky-500/10' },
  { id: 'nextjs',  name: 'Next.js',  sub: 'App Router',        icon: Globe,    color: 'text-foreground',  bg: 'bg-white/5' },
  { id: 'vue',     name: 'Vue',      sub: 'Vite + Composition', icon: Zap,     color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'flask',   name: 'Flask',    sub: 'Python',             icon: Server,  color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { id: 'express', name: 'Express',  sub: 'Node.js',            icon: Terminal, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { id: 'fastapi', name: 'FastAPI',  sub: 'Python',             icon: Cpu,     color: 'text-teal-400',    bg: 'bg-teal-500/10' },
];

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('react');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const createMutation = useCreateProject();

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generateLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      const project = await createMutation.mutateAsync({
        data: { name, description, framework },
      });

      const url = `${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/api/projects/${project.id}/generate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description }),
      });

      await parseSSE<{ content?: string; done?: boolean }>(
        response,
        (data) => { if (data.content) setGenerateLog((prev) => [...prev, data.content!]); },
        () => { setLocation(`/projects/${project.id}`); },
        (err) => { console.error('Generation failed:', err); setLocation(`/projects/${project.id}`); },
      );
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

  const selectedFw = FRAMEWORKS.find((f) => f.id === framework)!;

  /* ── Generating state ─────────────────────────────────────────────────────── */
  if (isGenerating) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Status */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center mx-auto shadow-lg shadow-[hsl(258,90%,66%,0.3)]">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Scaffolding your project…</h2>
            <p className="text-sm text-muted-foreground">
              Generating files for <span className="text-foreground font-medium">{name}</span>
            </p>
          </div>

          {/* Terminal log */}
          <div className="bg-[hsl(220,13%,7%)] rounded-2xl border border-[hsl(220,13%,16%)] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[hsl(220,13%,16%)]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-2 text-[11px] text-muted-foreground font-mono">spacze — generate</span>
            </div>
            <div className="p-4 font-mono text-xs h-52 overflow-y-auto flex flex-col gap-0.5">
              {generateLog.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log.startsWith('  ✓') ? (
                    <span className="text-emerald-400">{log}</span>
                  ) : log.startsWith('Error') ? (
                    <span className="text-red-400">{log}</span>
                  ) : (
                    <span className="text-muted-foreground">{log}</span>
                  )}
                </div>
              ))}
              <div className="text-muted-foreground cursor-blink">▋</div>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Top bar */}
      <header className="h-12 border-b border-border flex items-center gap-3 px-5 shrink-0 bg-[hsl(220,13%,9%)]">
        <Link href="/projects">
          <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,16%)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/projects">
            <span className="hover:text-foreground transition-colors cursor-pointer">Projects</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">New project</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">New project</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you want to build and the AI will scaffold the initial structure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Project name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Project name</label>
            <input
              type="text"
              placeholder="e.g. my-ecommerce-api"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)] rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(258,90%,66%,0.5)] transition-colors font-mono"
            />
          </div>

          {/* Framework */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Framework</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FRAMEWORKS.map((fw) => {
                const Icon = fw.icon;
                const isSelected = framework === fw.id;
                return (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => setFramework(fw.id)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-[hsl(258,90%,66%,0.5)] bg-[hsl(258,90%,66%,0.08)] shadow-sm shadow-[hsl(258,90%,66%,0.1)]'
                        : 'border-[hsl(220,13%,20%)] bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] hover:border-[hsl(220,13%,28%)]',
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', fw.bg)}>
                      <Icon className={cn('w-3.5 h-3.5', fw.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium leading-none', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                        {fw.name}
                      </p>
                      <p className="text-[11px] mt-1 text-muted-foreground/60">{fw.sub}</p>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[hsl(258,90%,75%)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description & prompt</label>
            <div className={cn(
              'relative bg-[hsl(220,13%,14%)] border rounded-2xl transition-all',
              'border-[hsl(220,13%,20%)] focus-within:border-[hsl(258,90%,66%,0.5)]',
              'composer-glow',
            )}>
              <textarea
                placeholder="Describe the application in detail — what endpoints, components, or features do you need?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                className="w-full px-4 pt-4 pb-14 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {name && framework && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {selectedFw.name}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={!name.trim() || !description.trim()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    name.trim() && description.trim()
                      ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)] shadow-md shadow-[hsl(258,90%,66%,0.3)]'
                      : 'bg-[hsl(220,13%,20%)] text-muted-foreground cursor-not-allowed',
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Be specific — the more detail you provide, the better the scaffold.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
