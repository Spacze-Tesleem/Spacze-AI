import React from 'react';
import { Link } from 'wouter';
import {
  useListProjects,
  getListProjectsQueryKey,
  useDeleteProject,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FolderGit2, Plus, Trash2, Clock, Terminal, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  scaffolding: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/15 text-red-400 border-red-500/20',
};

export default function ProjectList() {
  const { data: projects, isLoading } = useListProjects();
  const queryClient = useQueryClient();

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
        <Link href="/projects/new">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
            <Plus className="w-4 h-4" />
            New project
          </button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(0,0%,18%)] flex items-center justify-center">
              <FolderGit2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No projects yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Describe what you want to build and the AI will scaffold it.
              </p>
            </div>
            <Link href="/projects/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
                <Plus className="w-4 h-4" />
                Create project
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects?.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="group relative flex flex-col p-5 rounded-2xl bg-[hsl(0,0%,16%)] border border-border hover:border-[hsl(0,0%,28%)] hover:bg-[hsl(0,0%,18%)] transition-all cursor-pointer h-full">
                  {/* Status badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[hsl(0,0%,22%)] flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        STATUS_STYLES[project.status] ?? 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      {project.status}
                    </span>
                  </div>

                  {/* Name + description */}
                  <p className="font-semibold text-foreground text-sm leading-snug group-hover:text-white transition-colors line-clamp-1">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 flex-1">
                    {project.description || 'No description.'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>{project.framework}</span>
                    </div>
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
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
