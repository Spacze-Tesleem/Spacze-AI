import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  FolderGit2,
  MessageSquare,
  Plus,
  Sparkles,
  ChevronRight,
  Search,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/',         icon: Home,          label: 'Home' },
  { href: '/projects', icon: FolderGit2,    label: 'Projects' },
  { href: '/chat',     icon: MessageSquare, label: 'Chats' },
];

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [recentOpen, setRecentOpen] = useState(true);
  const queryClient = useQueryClient();

  const { data: rawConversations } = useListOpenaiConversations();
  const conversations = Array.isArray(rawConversations) ? rawConversations : [];

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data: { id: number }) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${data.id}`);
      },
    },
  });

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const filteredConversations = conversations
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 10);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="w-[240px] flex flex-col shrink-0 overflow-hidden border-r border-sidebar-border"
        style={{ background: 'hsl(220 13% 7%)' }}
      >
        {/* Logo */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              Spacze AI
            </span>
          </div>
        </div>

        {/* New Chat */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={() => createMutation.mutate({ data: { title: 'New conversation' } })}
            disabled={createMutation.isPending}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              'bg-[hsl(258,90%,66%,0.1)] text-[hsl(258,90%,78%)] border border-[hsl(258,90%,66%,0.2)]',
              'hover:bg-[hsl(258,90%,66%,0.18)] hover:border-[hsl(258,90%,66%,0.35)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            New chat
          </button>
        </div>

        {/* Primary nav */}
        <nav className="px-2 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all w-full',
                isActive(href)
                  ? 'bg-[hsl(220,13%,16%)] text-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-[hsl(220,13%,13%)] hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 my-3 border-t border-sidebar-border" />

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[hsl(220,13%,12%)] border border-sidebar-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(258,90%,66%,0.4)] transition-colors"
            />
          </div>
        </div>

        {/* Recent Chats */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
          <button
            onClick={() => setRecentOpen((o) => !o)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-[hsl(220,13%,13%)]"
          >
            <span>Recent</span>
            <ChevronRight
              className={cn(
                'w-3 h-3 transition-transform duration-150',
                recentOpen && 'rotate-90',
              )}
            />
          </button>

          {recentOpen && (
            <div className="mt-0.5 space-y-0.5">
              {filteredConversations.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground/60">No chats yet</p>
              ) : (
                filteredConversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all w-full truncate',
                      location === `/chat/${conv.id}`
                        ? 'bg-[hsl(220,13%,16%)] text-foreground'
                        : 'text-sidebar-foreground hover:bg-[hsl(220,13%,13%)] hover:text-foreground',
                    )}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0 opacity-50" />
                    <span className="truncate">{conv.title}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="px-3 py-3 border-t border-sidebar-border shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[hsl(258,90%,66%,0.15)] border border-[hsl(258,90%,66%,0.3)] flex items-center justify-center">
              <Zap className="w-3 h-3 text-[hsl(258,90%,75%)]" />
            </div>
            <span className="text-xs text-muted-foreground">Free plan</span>
          </div>
          <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,13%)] transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
