import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { 
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseSSE } from '@/lib/sse';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatThread() {
  const { id } = useParams();
  const convId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();
  
  const { data: conversation, isLoading } = useGetOpenaiConversation(convId, {
    query: { enabled: !!convId, queryKey: getGetOpenaiConversationQueryKey(convId) }
  });

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = conversation?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    const content = input;
    setInput('');
    setIsSending(true);
    setStreamingContent('');

    // Optimistically add user message
    const tempUserMsg = { id: Date.now(), role: 'user', content, createdAt: new Date().toISOString(), conversationId: convId };
    
    queryClient.setQueryData(getGetOpenaiConversationQueryKey(convId), (old: any) => {
      if (!old) return old;
      return { ...old, messages: [...old.messages, tempUserMsg] };
    });

    try {
      const res = await fetch(`${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/openai/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      await parseSSE<{content?: string, done?: boolean}>(
        res,
        (data) => {
          if (data.content) {
            setStreamingContent(prev => prev + data.content);
          }
        },
        () => {
          // Done
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header className="flex items-center gap-4 p-4 border-b border-border bg-card/80 backdrop-blur-sm z-10">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chat">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h2 className="font-semibold text-lg">{conversation?.title || 'Loading...'}</h2>
          <p className="text-xs text-muted-foreground font-mono">ID: {convId}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5" />
                </div>
              )}
              
              <div 
                className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border rounded-tl-sm text-foreground prose-invert prose prose-sm max-w-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 mt-1">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-5 h-5" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-card border border-border rounded-tl-sm text-foreground prose-invert prose prose-sm">
                {streamingContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamingContent}
                  </ReactMarkdown>
                ) : (
                  <div className="flex gap-1 items-center h-5 text-muted-foreground">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 bg-background border-t border-border">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-card border border-border rounded-xl p-2 focus-within:ring-1 ring-primary transition-all">
          <Textarea 
            placeholder="Send a message..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] max-h-60 resize-none border-0 shadow-none focus-visible:ring-0 p-3 bg-transparent"
            disabled={isSending}
            rows={1}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isSending}
            size="icon"
            className="mb-1 shrink-0 rounded-lg"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2 font-mono">
          Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
