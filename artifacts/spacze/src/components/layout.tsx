import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  MessageSquare,
  FolderGit2,
  Plus,
  LayoutDashboard,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  type OpenaiConversation,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const queryClient = useQueryClient();

  const { data: conversations } = useListOpenaiConversations();

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data: OpenaiConversation) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${data.id}`);
      },
    },
  });

  const handleNewChat = () => {
    createMutation.mutate({ data: { title: 'New conversation' } });
  };

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-64'
        )}
      >
        {/* Top: logo + collapse toggle */}
        <div className="flex items-center justify-between h-14 px-3 shrink-0">
          {collapsed ? (
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center mx-auto">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-background" />
                </div>
                <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
                  Spacze AI
                </span>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* New Chat button */}
        <div className={cn('px-2 mb-2', collapsed && 'flex justify-center')}>
          <button
            onClick={handleNewChat}
            disabled={createMutation.isPending}
            className={cn(
              'flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors',
              'text-sidebar-foreground hover:bg-sidebar-accent',
              collapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2.5'
            )}
            title="New chat"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!collapsed && <span>New chat</span>}
          </button>
        </div>

        {/* Nav items */}
        <nav className={cn('px-2 space-y-0.5', collapsed && 'flex flex-col items-center gap-0.5')}>
          {[
            { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
            { href: '/chat', icon: MessageSquare, label: 'Chats' },
            { href: '/projects', icon: FolderGit2, label: 'Projects' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg text-sm transition-colors',
                collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2.5',
                isActive(href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Conversation history */}
        {!collapsed && conversations && conversations.length > 0 && (
          <div className="mt-4 flex-1 overflow-y-auto min-h-0">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Recent chats
            </p>
            <div className="px-2 space-y-0.5">
              {conversations.slice(0, 20).map((conv: OpenaiConversation) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    location === `/chat/${conv.id}`
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{conv.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {collapsed && (
          <div className="flex justify-center pb-4">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
