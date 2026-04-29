import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  type OpenaiConversation,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquare, Plus, Trash2, Search, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function ChatList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: conversations, isLoading } = useListOpenaiConversations();

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data: OpenaiConversation) => {
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

  const filtered = conversations?.filter((c: OpenaiConversation) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Conversations</h1>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[hsl(0,0%,18%)] border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(0,0%,35%)] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="space-y-2 mt-2">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(0,0%,18%)] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-muted-foreground" />
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            {filtered?.map((conv: OpenaiConversation) => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <div className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[hsl(0,0%,18%)] transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-[hsl(0,0%,18%)] group-hover:bg-[hsl(0,0%,22%)] flex items-center justify-center shrink-0 transition-colors">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(conv.createdAt), 'MMM d, yyyy')}
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
        )}
      </div>
    </div>
  );
}
