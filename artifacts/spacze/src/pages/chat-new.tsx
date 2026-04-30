import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  useCreateOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  Sparkles,
  ChevronDown,
  Code2,
  Zap,
  Globe,
  Image,
  Mic,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  { label: 'Scaffold a React app',    icon: Code2,  hint: 'Vite + TypeScript' },
  { label: 'Debug my code',           icon: Zap,    hint: 'Paste an error' },
  { label: 'Explain an architecture', icon: Globe,  hint: 'System design' },
  { label: 'Generate an image',       icon: Image,  hint: 'AI art' },
];

export default function ChatNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [input]);

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (conv: { id: number }) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setLocation(`/chat/${conv.id}?q=${encodeURIComponent(input.trim())}`);
      },
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || isCreating) return;
    setIsCreating(true);
    const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
    createMutation.mutate({ data: { title } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !isCreating;

  return (
    <div className="flex flex-col h-full bg-background items-center justify-center px-4">
      {/* Headline */}
      <div className="w-full max-w-2xl text-center mb-8 select-none space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(258,90%,66%,0.1)] border border-[hsl(258,90%,66%,0.2)] text-[hsl(258,90%,78%)] text-xs font-medium mb-1">
          <Sparkles className="w-3 h-3" />
          New conversation
        </div>
        <h1 className="text-4xl font-semibold text-foreground tracking-tight leading-tight">
          What do you want to build?
        </h1>
      </div>

      {/* Composer */}
      <div className="w-full max-w-2xl">
        <div className={cn(
          'rounded-2xl border bg-[hsl(220,13%,12%)] transition-all duration-200',
          'border-[hsl(220,13%,20%)] composer-glow',
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Spacze AI to…"
            rows={3}
            disabled={isCreating}
            className={cn(
              'w-full bg-transparent text-foreground text-[15px] leading-relaxed',
              'placeholder:text-muted-foreground/60 resize-none focus:outline-none',
              'px-5 pt-5 pb-3 min-h-[88px] max-h-[240px] overflow-y-auto',
            )}
          />

          <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-3">
            {/* Model pill */}
            <button
              disabled
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[hsl(220,13%,22%)] text-muted-foreground bg-[hsl(220,13%,15%)] cursor-default"
            >
              <div className="w-3.5 h-3.5 rounded-sm brand-gradient flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </div>
              Spacze AI
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                canSend
                  ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)] shadow-lg shadow-[hsl(258,90%,66%,0.3)]'
                  : 'bg-[hsl(220,13%,18%)] text-muted-foreground cursor-not-allowed',
              )}
            >
              {isCreating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : canSend
                  ? <ArrowUp className="w-4 h-4" />
                  : <Mic className="w-4 h-4" />
              }
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40 mt-2.5">
          <kbd className="font-mono">Enter</kbd> to send ·{' '}
          <kbd className="font-mono">Shift+Enter</kbd> for new line
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 w-full max-w-2xl">
        {SUGGESTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => { setInput(label); textareaRef.current?.focus(); }}
            disabled={isCreating}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm',
              'bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] text-muted-foreground',
              'hover:border-[hsl(258,90%,66%,0.35)] hover:text-foreground hover:bg-[hsl(220,13%,15%)]',
              'transition-all disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
