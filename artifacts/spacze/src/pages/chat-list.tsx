import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { MessageSquare, Plus, Trash2, Search, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function groupByDate(conversations: any[]) {
  const groups: Record<string, any[]> = {};
  for (const conv of conversations) {
    const d = new Date(conv.createdAt);
    let key: string;
    if (isToday(d)) key = 'Today';
    else if (isYesterday(d)) key = 'Yesterday';
    else if (isThisWeek(d)) key = 'This week';
    else key = format(d, 'MMMM yyyy');
    if (!groups[key]) groups[key] = [];
    groups[key].push(conv);
  }
  return groups;
}

export default function ChatList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: rawConversations, isLoading } = useListOpenaiConversations();
  const conversations = Array.isArray(rawConversations) ? rawConversations : undefined;

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data: { id: number }) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${data.id}`);
      },
    },
  });

  const deleteMutation = useDeleteOpenaiConversation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      },
    },
  });

  const handleCreate = () => {
    createMutation.mutate({ data: { title: 'New conversation' } });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteMutation.mutate({ id });
    }
  };

  const filtered = conversations?.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = filtered ? groupByDate(filtered) : {};

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-[hsl(220,13%,9%)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-base font-semibold text-foreground">Conversations</h1>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)]',
            'shadow-md shadow-[hsl(258,90%,66%,0.25)] disabled:opacity-50',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </header>

      {/* Search */}
      <div className="px-6 py-3 shrink-0 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)] rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(258,90%,66%,0.4)] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)] flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a new chat to get going.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(258,90%,66%)] text-white text-sm font-medium hover:bg-[hsl(258,90%,60%)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([group, convs]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                  {group}
                </p>
                <div className="space-y-1">
                  {convs.map((conv) => (
                    <Link key={conv.id} href={`/chat/${conv.id}`}>
                      <div className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[hsl(220,13%,14%)] border border-transparent hover:border-[hsl(220,13%,20%)] transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-xl bg-[hsl(220,13%,14%)] group-hover:bg-[hsl(220,13%,18%)] flex items-center justify-center shrink-0 transition-colors border border-[hsl(220,13%,20%)]">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(conv.createdAt), 'h:mm a · MMM d, yyyy')}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
