import React from 'react';
import { Link } from 'wouter';
import { useGetProjectStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderGit2, MessageSquare, Plus, Activity, Clock, Terminal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetProjectStats();

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, Developer.</p>
          </div>
          <div className="flex gap-4">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/chat">
                <MessageSquare className="w-4 h-4" />
                New Chat
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/projects/new">
                <Plus className="w-4 h-4" />
                New Project
              </Link>
            </Button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.total || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Frameworks</CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{Object.keys(stats?.byFramework || {}).length}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-primary flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                Online
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Recent Projects */}
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Projects</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : stats?.recentProjects?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderGit2 className="mx-auto h-8 w-8 mb-2 opacity-20" />
                  <p>No projects yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats?.recentProjects?.slice(0, 5).map(project => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer group">
                        <div>
                          <div className="font-medium group-hover:text-primary transition-colors">{project.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">
                              {project.framework}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(project.updatedAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                        <div className="text-muted-foreground group-hover:translate-x-1 transition-transform">
                          →
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions / Getting Started */}
          <Card className="col-span-1 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Spacze AI Agent is your intelligent IDE. Describe what you want to build, and watch it generate code, fix bugs, and manage your files.
              </p>
              
              <div className="grid gap-3 mt-6">
                <Button className="w-full justify-start h-14 text-lg" variant="default" asChild>
                  <Link href="/projects/new">
                    <Plus className="mr-3 h-5 w-5" /> Scaffold a New Project
                  </Link>
                </Button>
                
                <Button className="w-full justify-start h-14 text-lg" variant="outline" asChild>
                  <Link href="/chat">
                    <MessageSquare className="mr-3 h-5 w-5" /> Start a Conversation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
