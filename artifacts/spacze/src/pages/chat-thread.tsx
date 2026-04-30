import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearch, Link } from 'wouter';
import {
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';
import { ArrowUp, Loader2, Sparkles, Copy, Check, Plus, Mic, FolderOpen, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ChatThread() {
  const { id } = useParams();
  const search = useSearch();
  const convId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const { data: conversation, isLoading } = useGetOpenaiConversation(convId, {
    query: { enabled: !!convId, queryKey: getGetOpenaiConversationQueryKey(convId) },
  });

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Tracks whether we've already fired the auto-send from ?q=
  const autoSentRef = useRef(false);

  const messages = conversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // If the page was opened with ?q=<prompt> (from chat-new), fire the first
  // message automatically once the conversation has loaded.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (!convId || isLoading) return;

    const params = new URLSearchParams(search);
    const q = params.get('q');
    if (!q) return;

    autoSentRef.current = true;
    // Remove the query param from the URL without a navigation
    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, '', cleanUrl);

    // Strip any SYSTEM_HINT prefix injected by the dashboard toolbar before
    // sending — the hint is for the server system prompt, not the user message.
    const userText = q.replace(/^\[SYSTEM_HINT:[^\]]*\]\n?/, '');
    sendMessage(userText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, isLoading, search]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isSending || !convId) return;

    setIsSending(true);
    setStreamingContent('');

    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      conversationId: convId,
    };

    queryClient.setQueryData(getGetOpenaiConversationQueryKey(convId), (old: any) => {
      if (!old) return old;
      return { ...old, messages: [...old.messages, tempUserMsg] };
    });

    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}/api/openai/conversations/${convId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      await parseSSE<{ content?: string; done?: boolean }>(
        res,
        (data) => {
          if (data.content) setStreamingContent((prev) => prev + data.content);
        },
        () => {
          setIsSending(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        },
        (error) => {
          console.error(error);
          setIsSending(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        }
      );
    } catch (e) {
      console.error(e);
      setIsSending(false);
      setStreamingContent('');
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const content = input;
    setInput('');
    sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0 && !isSending;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Empty state — only shown briefly before auto-send fires */}
      {isEmpty && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('group', msg.role === 'user' ? 'flex justify-end' : '')}>
                {msg.role === 'user' ? (
                  /* User bubble */
                  <div className="max-w-[85%] bg-[hsl(0,0%,20%)] text-foreground rounded-3xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  /* Assistant message — no bubble, just text */
                  <div className="flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="prose prose-sm prose-chat max-w-none text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton text={msg.content} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming assistant message */}
            {isSending && (
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-background" />
                </div>
                <div className="flex-1 min-w-0">
                  {streamingContent ? (
                    <div className="prose prose-sm prose-chat max-w-none text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center h-6">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar — v0-style */}
      <div className="px-4 pb-5 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'rounded-2xl border bg-[hsl(0,0%,14%)] transition-all duration-150',
            'border-[hsl(0,0%,20%)] focus-within:border-[hsl(0,0%,30%)]',
          )}>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              placeholder="Ask Spacze AI…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={2}
              className="w-full bg-transparent text-[15px] text-white leading-relaxed placeholder:text-[hsl(0,0%,38%)] resize-none focus:outline-none px-4 pt-4 pb-2 min-h-[72px] max-h-[200px] overflow-y-auto"
            />

            {/* Bottom toolbar */}
            <div className="flex items-center gap-2 px-3 pb-3">
              {/* + attach */}
              <button
                title="Attach file (coming soon)"
                disabled
                className="p-1.5 rounded-lg text-[hsl(0,0%,45%)] opacity-50 cursor-not-allowed"
              >
                <Plus className="w-[18px] h-[18px]" />
              </button>

              {/* Model pill */}
              <button
                disabled
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border border-[hsl(0,0%,24%)] text-[hsl(0,0%,60%)] bg-[hsl(0,0%,18%)] opacity-80 cursor-default"
              >
                <div className="w-4 h-4 rounded-sm bg-[hsl(0,0%,30%)] flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
                Spacze AI
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Project context */}
              <Link href="/projects">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-[hsl(0,0%,55%)] border border-[hsl(0,0%,22%)] hover:border-[hsl(0,0%,32%)] hover:text-white bg-[hsl(0,0%,18%)] transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Project
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
              </Link>

              {/* Send / mic */}
              <button
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  input.trim() && !isSending
                    ? 'bg-white text-[hsl(0,0%,8%)] hover:bg-[hsl(0,0%,88%)]'
                    : 'bg-[hsl(0,0%,20%)] text-[hsl(0,0%,38%)] cursor-not-allowed',
                )}
              >
                {isSending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : input.trim()
                    ? <ArrowUp className="w-4 h-4" />
                    : <Mic className="w-4 h-4" />
                }
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-[hsl(0,0%,35%)] mt-2">
            Spacze AI can make mistakes. <kbd className="font-mono">Shift+Enter</kbd> for new line.
          </p>
        </div>
      </div>
    </div>
  );
}
