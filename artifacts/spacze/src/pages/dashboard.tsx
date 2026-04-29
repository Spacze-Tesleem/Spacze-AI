import React from 'react';
import { Link } from 'wouter';
import { useGetProjectStats } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  FolderGit2,
  MessageSquare,
  Plus,
  ArrowRight,
  Sparkles,
  Terminal,
  Activity,
  Clock,
} from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetProjectStats();

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-background" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            What can I help you build?
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Scaffold projects, debug code, or just have a conversation.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/chat">
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-border hover:border-[hsl(0,0%,30%)] hover:bg-[hsl(0,0%,18%)] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-[hsl(0,0%,22%)] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">Start a conversation</p>
                <p className="text-xs text-muted-foreground mt-0.5">Chat with the AI assistant</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>

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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total projects',
              value: isLoading ? null : stats?.total ?? 0,
              icon: FolderGit2,
            },
            {
              label: 'Frameworks',
              value: isLoading ? null : Object.keys(stats?.byFramework ?? {}).length,
              icon: Terminal,
            },
            {
              label: 'Status',
              value: 'Online',
              icon: Activity,
              highlight: true,
            },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div
              key={label}
              className="p-4 rounded-2xl bg-[hsl(0,0%,16%)] border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${highlight ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              {value === null ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className={`text-2xl font-semibold ${highlight ? 'text-emerald-400' : 'text-foreground'}`}>
                  {value}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Recent projects */}
        {(isLoading || (stats?.recentProjects && stats.recentProjects.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent projects</h2>
              <Link href="/projects">
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  View all
                </span>
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
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-foreground">
                            {project.name}
                          </p>
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
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
