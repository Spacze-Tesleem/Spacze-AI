import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  useListOpenaiConversations, 
  useCreateOpenaiConversation, 
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MessageSquare, Plus, Trash2, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  
  const { data: conversations, isLoading } = useListOpenaiConversations();
  
  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${data.id}`);
      }
    }
  });

  const deleteMutation = useDeleteOpenaiConversation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({ data: { title: newTitle.trim() } });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteMutation.mutate({ id });
    }
  };

  const filtered = conversations?.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background p-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 flex-1 flex flex-col">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Conversations</h1>
            <p className="text-muted-foreground mt-1">Discuss architecture, algorithms, and ideas.</p>
          </div>
          
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input 
              placeholder="New discussion topic..." 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-64"
              disabled={createMutation.isPending}
            />
            <Button type="submit" disabled={!newTitle.trim() || createMutation.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </form>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search conversations..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-8">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : filtered?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl border-border bg-card/50">
              <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">No conversations found</h3>
              <p className="mt-1">Start a new chat to bounce ideas off the AI.</p>
            </div>
          ) : (
            filtered?.map(conv => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <Card className="p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer group border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg text-primary">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-lg group-hover:text-primary transition-colors">
                          {conv.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Started {format(new Date(conv.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(e, conv.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
