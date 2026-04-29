import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  useCreateOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  Paperclip,
  Zap,
  Globe,
  Image,
  Code2,
  Play,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Suggestion chips shown below the headline ─────────────────────────────────
const SUGGESTIONS = [
  { label: 'Scaffold a React app', icon: Code2 },
  { label: 'Debug my code', icon: Zap },
  { label: 'Explain an architecture', icon: Globe },
  { label: 'Generate an image', icon: Image },
];

// ── Toolbar action buttons (left side of composer footer) ─────────────────────
const TOOLBAR_ACTIONS = [
  { icon: Paperclip, label: 'Attach file', key: 'attach' },
  { icon: Zap,       label: 'Quick actions', key: 'quick' },
  { icon: Globe,     label: 'Web search', key: 'web' },
  { icon: Image,     label: 'Generate image', key: 'image' },
  { icon: Code2,     label: 'Code mode', key: 'code' },
  { icon: Play,      label: 'Run', key: 'run' },
];

export default function ChatNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'Agent' | 'Plan'>('Agent');
  const [isCreating, setIsCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [input]);

  const createMutation = useCreateOpenaiConversation({
    mutation: {
      onSuccess: async (conv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });

        // Navigate immediately — the thread page will stream the first message
        setLocation(`/chat/${conv.id}?q=${encodeURIComponent(input.trim())}`);
      },
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || isCreating) return;
    setIsCreating(true);

    // Derive a title from the first ~60 chars of the prompt
    const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
    createMutation.mutate({ data: { title } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (label: string) => {
    setInput(label);
    textareaRef.current?.focus();
  };

  const canSend = input.trim().length > 0 && !isCreating;

  return (
    <div className="flex flex-col h-full bg-background items-center justify-center px-4">
      {/* ── Headline ─────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl text-center mb-8 select-none">
        <h1 className="text-4xl font-semibold text-foreground tracking-tight leading-tight">
          What do you want to build?
        </h1>
      </div>

      {/* ── Composer card ────────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl">
        <div
          className={cn(
            'rounded-2xl border bg-[hsl(0,0%,16%)] transition-colors',
            'border-[hsl(0,0%,22%)] focus-within:border-[hsl(0,0%,32%)]',
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Spacze AI to…"
            rows={3}
            disabled={isCreating}
            className={cn(
              'w-full bg-transparent text-foreground text-sm leading-relaxed',
              'placeholder:text-muted-foreground resize-none focus:outline-none',
              'px-4 pt-4 pb-2 min-h-[80px] max-h-[240px] overflow-y-auto',
            )}
          />

          {/* Footer toolbar */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
            {/* Left: action icons */}
            <div className="flex items-center gap-0.5">
              {TOOLBAR_ACTIONS.map(({ icon: Icon, label, key }) => (
                <button
                  key={key}
                  title={label}
                  className={cn(
                    'p-2 rounded-lg text-muted-foreground',
                    'hover:text-foreground hover:bg-[hsl(0,0%,22%)] transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  disabled={isCreating}
                  // Toolbar buttons are UI affordances — wiring them up is a
                  // separate feature; they're intentionally no-ops here.
                  onClick={() => {}}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            {/* Right: mode toggle + send */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Mode pill */}
              <button
                onClick={() => setMode((m) => (m === 'Agent' ? 'Plan' : 'Agent'))}
                disabled={isCreating}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'border border-[hsl(0,0%,28%)] text-muted-foreground',
                  'hover:border-[hsl(0,0%,38%)] hover:text-foreground transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {mode}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
                  canSend
                    ? 'bg-foreground text-background hover:bg-foreground/85'
                    : 'bg-[hsl(0,0%,24%)] text-muted-foreground cursor-not-allowed',
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-[11px] text-muted-foreground mt-2.5">
          Press <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
        </p>
      </div>

      {/* ── Suggestion chips ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 w-full max-w-2xl">
        {SUGGESTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => handleSuggestion(label)}
            disabled={isCreating}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm',
              'bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,22%)] text-muted-foreground',
              'hover:border-[hsl(0,0%,32%)] hover:text-foreground hover:bg-[hsl(0,0%,19%)]',
              'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
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
