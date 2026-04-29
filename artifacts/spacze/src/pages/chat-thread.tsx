import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearch } from 'wouter';
import {
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';
import { ArrowUp, Loader2, Sparkles, Copy, Check } from 'lucide-react';
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

    // Trigger send with the prefilled prompt
    sendMessage(q);
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

      {/* Input bar — fixed at bottom, ChatGPT style */}
      <div className={cn('px-4 pb-4', isEmpty ? 'w-full max-w-3xl mx-auto' : '')}>
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-[hsl(0,0%,18%)] rounded-2xl border border-border px-4 py-3 focus-within:border-[hsl(0,0%,35%)] transition-colors">
            <textarea
              ref={textareaRef}
              placeholder="Message Spacze AI…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={1}
              className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[200px] overflow-y-auto"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors mb-0.5',
                input.trim() && !isSending
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-[hsl(0,0%,25%)] text-muted-foreground cursor-not-allowed'
              )}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Spacze AI can make mistakes. Press Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}
