import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  useListProjects,
  getListProjectsQueryKey,
  useDeleteProject,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FolderGit2,
  Plus,
  Trash2,
  Clock,
  Terminal,
  ArrowRight,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  scaffolding: {
    label: 'Building',
    icon: Loader2,
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

const FRAMEWORK_COLORS: Record<string, string> = {
  react:   'text-sky-400',
  nextjs:  'text-foreground',
  vue:     'text-emerald-400',
  flask:   'text-orange-400',
  express: 'text-yellow-400',
  fastapi: 'text-teal-400',
};

export default function ProjectList() {
  const { data: rawProjects, isLoading } = useListProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : undefined;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
    },
  });

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (confirm('Delete this project?')) {
      deleteMutation.mutate({ id });
    }
  };

  const filtered = projects?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.framework.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-[hsl(220,13%,9%)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-base font-semibold text-foreground">Projects</h1>
          {projects && (
            <span className="text-xs text-muted-foreground bg-[hsl(220,13%,16%)] border border-[hsl(220,13%,22%)] px-2 py-0.5 rounded-full tabular-nums">
              {projects.length}
            </span>
          )}
        </div>
        <Link href="/projects/new">
          <button className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)]',
            'shadow-md shadow-[hsl(258,90%,66%,0.25)]',
          )}>
            <Plus className="w-3.5 h-3.5" />
            New project
          </button>
        </Link>
      </header>

      {/* Search */}
      {(projects?.length ?? 0) > 0 && (
        <div className="px-6 py-3 shrink-0 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Filter projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)] rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(258,90%,66%,0.4)] transition-colors"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)] flex items-center justify-center">
              <FolderGit2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No projects yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Describe what you want to build and the AI will scaffold it.
              </p>
            </div>
            <Link href="/projects/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(258,90%,66%)] text-white text-sm font-medium hover:bg-[hsl(258,90%,60%)] transition-colors">
                <Plus className="w-4 h-4" />
                Create project
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered?.map((project) => {
              const status = STATUS_CONFIG[project.status] ?? {
                label: project.status,
                icon: Terminal,
                classes: 'bg-muted text-muted-foreground border-border',
              };
              const StatusIcon = status.icon;
              const fwColor = FRAMEWORK_COLORS[project.framework] ?? 'text-muted-foreground';

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group relative flex flex-col p-5 rounded-2xl bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(258,90%,66%,0.3)] hover:bg-[hsl(220,13%,14%)] transition-all cursor-pointer h-full">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(220,13%,18%)] border border-[hsl(220,13%,24%)] flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className={cn(
                        'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        status.classes,
                      )}>
                        <StatusIcon className={cn('w-2.5 h-2.5', project.status === 'scaffolding' && 'animate-spin')} />
                        {status.label}
                      </span>
                    </div>

                    {/* Name + description */}
                    <p className="font-semibold text-foreground text-sm leading-snug line-clamp-1">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 flex-1 leading-relaxed">
                      {project.description || 'No description.'}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[hsl(220,13%,18%)]">
                      <span className={cn('text-xs font-mono font-medium', fwColor)}>
                        {project.framework}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(project.updatedAt), 'MMM d')}
                        </span>
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
