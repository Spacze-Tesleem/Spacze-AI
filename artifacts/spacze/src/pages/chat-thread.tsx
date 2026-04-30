import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearch, Link } from 'wouter';
import {
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';
import {
  ArrowUp,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Mic,
  ChevronDown,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,18%)] transition-colors"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center h-5 px-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
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
  const autoSentRef = useRef(false);

  const messages = conversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (autoSentRef.current) return;
    if (!convId || isLoading) return;
    const params = new URLSearchParams(search);
    const q = params.get('q');
    if (!q) return;
    autoSentRef.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    const userText = q.replace(/^\[SYSTEM_HINT:[^\]]*\]\n?/, '');
    sendMessage(userText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, isLoading, search]);

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
        },
      );

      await parseSSE<{ content?: string; done?: boolean }>(
        res,
        (data) => { if (data.content) setStreamingContent((p) => p + data.content); },
        () => {
          setIsSending(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        },
        (err) => {
          console.error(err);
          setIsSending(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        },
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
      {/* Top bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-5 shrink-0 bg-[hsl(220,13%,9%)]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md brand-gradient flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
            {conversation?.title ?? 'Chat'}
          </span>
        </div>
        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,16%)] transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Loading / empty */}
      {isEmpty && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {(messages as any[]).map((msg, i) => (
              <div
                key={msg.id}
                className={cn(
                  'group animate-fade-up',
                  msg.role === 'user' ? 'flex justify-end' : '',
                )}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] bg-[hsl(220,13%,18%)] text-foreground rounded-2xl rounded-br-sm px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap border border-[hsl(220,13%,24%)]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="flex gap-3.5">
                    <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
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

            {/* Streaming */}
            {isSending && (
              <div className="flex gap-3.5 animate-fade-up">
                <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  {streamingContent ? (
                    <div className="prose prose-sm prose-chat max-w-none text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <ThinkingDots />
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-5 pt-2 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div
            className={cn(
              'rounded-2xl border bg-[hsl(220,13%,12%)] transition-all duration-200',
              'border-[hsl(220,13%,20%)] composer-glow',
            )}
          >
            <textarea
              ref={textareaRef}
              placeholder="Ask Spacze AI…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={2}
              className="w-full bg-transparent text-[15px] text-foreground leading-relaxed placeholder:text-muted-foreground/60 resize-none focus:outline-none px-5 pt-4 pb-2 min-h-[72px] max-h-[200px] overflow-y-auto"
            />

            <div className="flex items-center gap-2 px-4 pb-3.5">
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

              <div className="flex-1" />

              {/* Project context */}
              <Link href="/projects">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground border border-[hsl(220,13%,22%)] hover:border-[hsl(220,13%,32%)] hover:text-foreground bg-[hsl(220,13%,15%)] transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Project
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
              </Link>

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  input.trim() && !isSending
                    ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)] shadow-lg shadow-[hsl(258,90%,66%,0.3)]'
                    : 'bg-[hsl(220,13%,18%)] text-muted-foreground cursor-not-allowed',
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
          <p className="text-center text-[11px] text-muted-foreground/40 mt-2">
            Spacze AI can make mistakes. <kbd className="font-mono">Shift+Enter</kbd> for new line.
          </p>
        </div>
      </div>
    </div>
  );
}
