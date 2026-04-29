import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateProject } from '@workspace/api-client-react';
import { parseSSE } from '@/lib/sse';
import { Loader2, Sparkles, ArrowUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const FRAMEWORKS = [
  { id: 'react',   name: 'React',    sub: 'Vite + TypeScript' },
  { id: 'nextjs',  name: 'Next.js',  sub: 'App Router' },
  { id: 'vue',     name: 'Vue',      sub: 'Vite + Composition API' },
  { id: 'flask',   name: 'Flask',    sub: 'Python' },
  { id: 'express', name: 'Express',  sub: 'Node.js' },
  { id: 'fastapi', name: 'FastAPI',  sub: 'Python' },
];

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('react');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState<string[]>([]);

  const createMutation = useCreateProject();

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
        (data) => {
          if (data.content) setGenerateLog((prev) => [...prev, data.content!]);
        },
        () => {
          setLocation(`/projects/${project.id}`);
        },
        (err) => {
          console.error('Generation failed:', err);
          setLocation(`/projects/${project.id}`);
        }
      );
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 text-background animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Scaffolding your project…</h2>
            <p className="text-sm text-muted-foreground">
              The AI is generating files and wiring up dependencies.
            </p>
          </div>

          <div className="bg-[hsl(0,0%,10%)] rounded-2xl border border-border p-4 font-mono text-xs text-emerald-400 h-56 overflow-y-auto flex flex-col gap-0.5">
            {generateLog.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log.startsWith('  ✓') ? (
                  <span className="text-emerald-400">{log}</span>
                ) : (
                  <span className="text-muted-foreground">{log}</span>
                )}
              </div>
            ))}
            <div className="animate-pulse text-muted-foreground">▋</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">New project</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you want to build and the AI will scaffold the initial structure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Project name</label>
            <input
              type="text"
              placeholder="e.g. my-ecommerce-api"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[hsl(0,0%,18%)] border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(0,0%,35%)] transition-colors font-mono"
            />
          </div>

          {/* Framework */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Framework</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => setFramework(fw.id)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                    framework === fw.id
                      ? 'border-foreground/40 bg-[hsl(0,0%,22%)] text-foreground'
                      : 'border-border bg-[hsl(0,0%,16%)] text-muted-foreground hover:bg-[hsl(0,0%,18%)] hover:text-foreground'
                  )}
                >
                  <div>
                    <p className="text-sm font-medium leading-none">{fw.name}</p>
                    <p className="text-[11px] mt-1 opacity-60">{fw.sub}</p>
                  </div>
                  {framework === fw.id && (
                    <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description / prompt */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Description & prompt</label>
            <div className="relative bg-[hsl(0,0%,18%)] border border-border rounded-2xl focus-within:border-[hsl(0,0%,35%)] transition-colors">
              <textarea
                placeholder="Describe the application in detail — what endpoints, components, or features do you need?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                className="w-full px-4 pt-4 pb-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  type="submit"
                  disabled={!name.trim() || !description.trim()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    name.trim() && description.trim()
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-[hsl(0,0%,25%)] text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
