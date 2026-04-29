import React from 'react';
import { Link } from 'wouter';
import { 
  useListProjects,
  getListProjectsQueryKey,
  useDeleteProject
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderGit2, Plus, Terminal, Trash2, Clock, Code2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function ProjectList() {
  const { data: projects, isLoading } = useListProjects();
  const queryClient = useQueryClient();

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      }
    }
  });

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate({ id });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
      case 'scaffolding': return 'bg-amber-500/20 text-amber-400 border-amber-500/20 animate-pulse';
      case 'error': return 'bg-destructive/20 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <p className="text-muted-foreground mt-1">Your codebases and workspaces.</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/projects/new">
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </Button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed rounded-xl border-border bg-card/30">
            <FolderGit2 className="mx-auto h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-xl font-medium text-foreground">No projects yet</h3>
            <p className="mt-2 mb-6 max-w-md mx-auto">Create a new project and let the AI scaffold the boilerplate for you.</p>
            <Button asChild>
              <Link href="/projects/new">Create Project</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer group flex flex-col border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="bg-primary/10 p-2 rounded-md text-primary mb-3">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <Badge variant="outline" className={`font-mono uppercase text-[10px] ${getStatusColor(project.status)}`}>
                        {project.status}
                      </Badge>
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors text-xl line-clamp-1">
                      {project.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || 'No description provided.'}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-foreground bg-accent px-2 py-1 rounded">
                        <Code2 className="w-3 h-3" />
                        {project.framework}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(project.updatedAt), 'MMM d')}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(e, project.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
