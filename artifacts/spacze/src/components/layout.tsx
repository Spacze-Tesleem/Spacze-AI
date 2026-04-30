import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  FolderGit2,
  MessageSquare,
  Layers,
  LayoutTemplate,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useListOpenaiConversations, useCreateOpenaiConversation, getListOpenaiConversationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/',          icon: Home,           label: 'Home' },
  { href: '/projects',  icon: FolderGit2,     label: 'Projects' },
  { href: '/chat',      icon: MessageSquare,  label: 'Chats' },
  { href: '/design',    icon: Layers,         label: 'Design Systems' },
  { href: '/templates', icon: LayoutTemplate, label: 'Templates' },
];

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const queryClient = useQueryClient();

  const { data: rawConversations } = useListOpenaiConversations();
  const conversations = Array.isArray(rawConversations) ? rawConversations : [];

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${data.id}`);
      },
    },
  });

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  const filteredConversations = conversations
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[260px] flex flex-col bg-[hsl(0,0%,7%)] shrink-0 overflow-hidden">

        {/* New Chat button */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center rounded-xl overflow-hidden border border-[hsl(0,0%,20%)]">
            <button
              onClick={() => createMutation.mutate({ data: { title: 'New conversation' } })}
              disabled={createMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-foreground hover:bg-[hsl(0,0%,14%)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
            <div className="w-px h-6 bg-[hsl(0,0%,20%)]" />
            <button className="px-3 py-2.5 text-foreground hover:bg-[hsl(0,0%,14%)] transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Primary nav */}
        <nav className="px-2 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full',
                isActive(href)
                  ? 'bg-[hsl(0,0%,18%)] text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-[hsl(0,0%,14%)] hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 my-3 border-t border-[hsl(0,0%,16%)]" />

        {/* Scrollable lower section */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">

          {/* Favorites */}
          <button
            onClick={() => setFavoritesOpen((o) => !o)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-[hsl(0,0%,14%)]"
          >
            <span className="font-medium">Favorites</span>
            <ChevronRight
              className={cn(
                'w-4 h-4 transition-transform duration-150',
                favoritesOpen && 'rotate-90'
              )}
            />
          </button>
          {favoritesOpen && (
            <div className="px-3 py-2 text-xs text-muted-foreground/60">
              No favorites yet
            </div>
          )}

          {/* Recent Chats */}
          <button
            onClick={() => setRecentOpen((o) => !o)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-[hsl(0,0%,14%)]"
          >
            <span className="font-medium">Recent Chats</span>
            <ChevronRight
              className={cn(
                'w-4 h-4 transition-transform duration-150',
                recentOpen && 'rotate-90'
              )}
            />
          </button>
          {recentOpen && (
            <div className="space-y-0.5">
              {filteredConversations.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground/60">
                  No recent chats
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full truncate',
                      location === `/chat/${conv.id}`
                        ? 'bg-[hsl(0,0%,18%)] text-foreground'
                        : 'text-muted-foreground hover:bg-[hsl(0,0%,14%)] hover:text-foreground'
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{conv.title}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom: branding */}
        <div className="px-4 py-3 border-t border-[hsl(0,0%,14%)] shrink-0 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-background" />
          </div>
          <span className="text-xs font-semibold text-sidebar-foreground tracking-tight">
            Spacze AI
          </span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
