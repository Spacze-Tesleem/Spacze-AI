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
  Code2,
  MessageSquare,
  GitBranch,
  X,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

// ── Copy button ───────────────────────────────────────────────────────────────
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

// ── Thinking dots ─────────────────────────────────────────────────────────────
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

// ── Code pane — shows extracted code blocks from the conversation ─────────────
function extractCodeBlocks(messages: any[]): Array<{ lang: string; code: string; label: string }> {
  const blocks: Array<{ lang: string; code: string; label: string }> = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(msg.content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trimEnd();
      // derive a short label from the first line (e.g. filename comment or shebang)
      const firstLine = code.split('\n')[0];
      const label =
        firstLine.startsWith('//') || firstLine.startsWith('#')
          ? firstLine.replace(/^[/#\s]+/, '').slice(0, 40)
          : `${lang} snippet`;
      blocks.push({ lang, code, label });
    }
  }
  return blocks;
}

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-sky-400',
  javascript: 'text-yellow-400',
  python:     'text-teal-400',
  html:       'text-orange-400',
  css:        'text-violet-400',
  json:       'text-amber-400',
  bash:       'text-emerald-400',
  sh:         'text-emerald-400',
};

function CodePane({
  messages,
  streamingContent,
  isSending,
}: {
  messages: any[];
  streamingContent: string;
  isSending: boolean;
}) {
  const allMessages = isSending && streamingContent
    ? [...messages, { role: 'assistant', content: streamingContent }]
    : messages;

  const blocks = extractCodeBlocks(allMessages);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Always show the latest block when new ones arrive
  useEffect(() => {
    if (blocks.length > 0) setSelectedIdx(blocks.length - 1);
  }, [blocks.length]);

  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none bg-[hsl(220,13%,8%)]">
        <Code2 className="w-10 h-10 opacity-10" />
        <p className="text-sm text-muted-foreground/50">
          Code blocks will appear here
        </p>
      </div>
    );
  }

  const active = blocks[selectedIdx];
  const langColor = LANG_COLORS[active?.lang] ?? 'text-muted-foreground';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[hsl(220,13%,8%)]">
      {/* File tabs */}
      {blocks.length > 1 && (
        <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-border overflow-x-auto shrink-0">
          {blocks.map((b, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-[12px] font-mono whitespace-nowrap transition-colors border-b-2',
                i === selectedIdx
                  ? 'text-foreground border-[hsl(258,90%,66%)] bg-[hsl(220,13%,11%)]'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-[hsl(220,13%,12%)]',
              )}
            >
              <Code2 className={cn('w-3 h-3 shrink-0', i === selectedIdx ? langColor : 'opacity-40')} />
              <span className="truncate max-w-[120px]">{b.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto p-5">
        <pre className={cn(
          'font-mono text-[13px] leading-[1.7] whitespace-pre-wrap break-words',
          langColor,
        )}>
          {active?.code}
          {isSending && selectedIdx === blocks.length - 1 && (
            <span className="cursor-blink text-muted-foreground">▌</span>
          )}
        </pre>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [sendError, setSendError] = useState<string | null>(null);
  // 'chat' | 'code' — which tab is active in task mode
  const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
  // true once the first message has been sent — switches to task mode layout
  const [taskMode, setTaskMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  const messages = (conversation?.messages as any[]) || [];

  // Enter task mode as soon as there are messages
  useEffect(() => {
    if (messages.length > 0) setTaskMode(true);
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-send from ?q= param (navigated from dashboard / chat-new)
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
    setTaskMode(true);
    setStreamingContent('');
    setSendError(null);

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
        (data) => {
          if (data.content) {
            setStreamingContent((p) => p + data.content);
            // Auto-switch to code tab when code starts streaming
            if (data.content.includes('```')) setActiveTab('code');
          }
        },
        () => {
          setIsSending(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        },
        (err) => {
          console.error(err);
          setIsSending(false);
          setStreamingContent('');
          setSendError(err.message ?? 'Something went wrong. Check the API server is running.');
          queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
        },
      );
    } catch (e: any) {
      console.error(e);
      setIsSending(false);
      setStreamingContent('');
      setSendError(e?.message ?? 'Could not reach the API server.');
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

  const title = conversation?.title ?? 'Chat';
  const shortTitle = title.length > 36 ? title.slice(0, 33) + '…' : title;

  // ── Composer (shared between both layouts) ──────────────────────────────────
  const composer = (
    <div className={cn('px-4 pb-4 pt-2 shrink-0', taskMode ? 'border-t border-border' : '')}>
      <div className={taskMode ? '' : 'max-w-3xl mx-auto'}>
        <div className={cn(
          'rounded-2xl border bg-[hsl(220,13%,12%)] transition-all duration-200',
          'border-[hsl(220,13%,20%)] composer-glow',
        )}>
          <textarea
            ref={textareaRef}
            placeholder="Ask Spacze AI…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            rows={taskMode ? 1 : 2}
            className="w-full bg-transparent text-[15px] text-foreground leading-relaxed placeholder:text-muted-foreground/60 resize-none focus:outline-none px-4 pt-3 pb-2 min-h-[52px] max-h-[200px] overflow-y-auto"
          />
          <div className="flex items-center gap-2 px-3 pb-3">
            <button
              disabled
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border border-[hsl(220,13%,22%)] text-muted-foreground bg-[hsl(220,13%,15%)] cursor-default"
            >
              <div className="w-3 h-3 rounded-sm brand-gradient flex items-center justify-center">
                <Sparkles className="w-1.5 h-1.5 text-white" />
              </div>
              Spacze AI
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSend}
              disabled={isSending}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0',
                input.trim() && !isSending
                  ? 'bg-[hsl(258,90%,66%)] text-white hover:bg-[hsl(258,90%,60%)] shadow-md shadow-[hsl(258,90%,66%,0.3)]'
                  : 'bg-[hsl(220,13%,18%)] text-muted-foreground cursor-not-allowed',
              )}
            >
              {isSending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : input.trim()
                  ? <ArrowUp className="w-3.5 h-3.5" />
                  : <Mic className="w-3.5 h-3.5" />
              }
            </button>
          </div>
        </div>
        {!taskMode && (
          <p className="text-center text-[11px] text-muted-foreground/40 mt-2">
            Spacze AI can make mistakes. <kbd className="font-mono">Shift+Enter</kbd> for new line.
          </p>
        )}
      </div>
    </div>
  );

  // ── Pre-task: centered empty state ──────────────────────────────────────────
  if (!taskMode) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
        {sendError && (
          <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{sendError}</span>
            <button
              onClick={() => setSendError(null)}
              className="ml-auto shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {composer}
      </div>
    );
  }

  // ── Task mode: top tab bar + split panes ────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-border bg-[hsl(220,13%,8%)] shrink-0">
        {/* Left: branch-style indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[hsl(220,13%,14%)] border border-[hsl(220,13%,20%)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <GitBranch className="w-3 h-3 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground font-mono">main</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground opacity-60" />
          </div>
        </div>

        {/* Center: horizontal tabs */}
        <div className="flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
          {/* Code tab */}
          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
              activeTab === 'code'
                ? 'bg-[hsl(220,13%,16%)] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,13%)]',
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code
          </button>

          {/* Chat / task tab — shows truncated conversation title */}
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors max-w-[260px]',
              activeTab === 'chat'
                ? 'bg-[hsl(220,13%,16%)] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,13%)]',
            )}
          >
            <div className="w-4 h-4 rounded-sm brand-gradient flex items-center justify-center shrink-0">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="truncate">{shortTitle}</span>
            <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {isSending && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking…
            </div>
          )}
          <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(220,13%,14%)] transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Pane area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Code pane — always mounted, hidden when chat tab active on narrow */}
        <div className={cn(
          'flex flex-col overflow-hidden transition-all duration-200',
          activeTab === 'code' ? 'flex-1' : 'hidden',
        )}>
          <CodePane
            messages={messages}
            streamingContent={streamingContent}
            isSending={isSending}
          />
        </div>

        {/* Chat pane */}
        <div className={cn(
          'flex flex-col overflow-hidden transition-all duration-200',
          activeTab === 'chat' ? 'flex-1' : 'hidden',
        )}>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg: any, i: number) => (
                <div
                  key={msg.id}
                  className={cn(
                    'group animate-fade-up',
                    msg.role === 'user' ? 'flex justify-end' : '',
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
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

              {/* Streaming assistant message */}
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

          {/* Error banner */}
          {sendError && (
            <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{sendError}</span>
              <button
                onClick={() => setSendError(null)}
                className="ml-auto shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Composer inside chat pane */}
          {composer}
        </div>
      </div>
    </div>
  );
}
