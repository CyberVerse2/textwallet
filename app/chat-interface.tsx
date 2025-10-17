'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Bot, Sparkles, ArrowLeft, RefreshCw } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatInterfaceProps {}

// Define type for code component props to fix TypeScript error
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const prevMessagesLengthRef = useRef<number>(0);
  const prevInputRef = useRef<string>('');
  const prevIsLoadingRef = useRef<boolean>(false);

  // Use the existing ChatContext instead of direct AI SDK
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
    setMessages,
    setInput,
    // Custom context values
    isWalletConnected,
    walletAddress,
    scrollAreaRef
  } = useChatContext();

  const [isActing, setIsActing] = useState(false);
  const triggeredIdsRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Helper to extract display text from UIMessage (AI SDK v5) or fallback to legacy content
  function getMessageText(m: any): string {
    try {
      if (Array.isArray(m?.parts)) {
        return m.parts
          .map((p: any) => (p && p.type === 'text' ? String(p.text ?? '') : ''))
          .join(' ')
          .trim();
      }
      return String(m?.content ?? '');
    } catch {
      return '';
    }
  }

  // Spend permission flow removed (subaccounts auto-spend). Leaving no-op helpers for backward compatibility.
  function parseSpendPermissionTag(_content: string) {
    return null;
  }

  function normalizeMarkdown(s: string) {
    if (!s) return s;
    // Ensure headings start on a new line
    let out = s.replace(/([^\n])(#+\s)/g, '$1\n$2');
    // Ensure a blank line before top-level headings for better rendering
    out = out.replace(/\n(#+\s)/g, '\n\n$1');
    // Add a space after periods when followed by alphanumerics or markup to avoid run-ons
    out = out.replace(/\.([A-Za-z0-9#\[])/g, '. $1');
    // Put ACTION tags on their own block with a blank line before
    out = out.replace(/\s*\[ACTION:/g, '\n\n[ACTION:');
    return out;
  }

  function parseTriggerTag(_content: string) {
    return null;
  }

  // Removed spend permission confirmation flow entirely

  // Removed auto-trigger spend permission effect

  // Log state changes to see what's happening
  useEffect(() => {
    // Check if messages changed
    if (messages.length !== prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
    }

    // Check if input changed
    if (input !== prevInputRef.current) {
      prevInputRef.current = input;
    }

    // Check if loading state changed
    if (isLoading !== prevIsLoadingRef.current) {
      prevIsLoadingRef.current = isLoading;
    }
  }, [messages, input, isLoading]);

  // Log errors when they occur
  useEffect(() => {
    if (error) {
      console.error('💬 Chat UI: Error from context:', error);
    }
  }, [error]);

  // Log the messages array whenever it changes
  useEffect(() => {
    console.log('💬 Chat UI: Messages array updated:', messages);
  }, [messages]);

  // Suggestions and initial assistant intro
  const suggestions: { label: string; prompt: string }[] = [
    { label: 'Show top Polymarket markets', prompt: 'show top markets with best upside' },
    { label: 'Grant $200/week budget', prompt: 'grant $200/week until next month' },
    {
      label: 'Buy YES $5 @ 0.44 (paste market URL)',
      prompt: 'buy YES 5 @ 0.44 on <paste market URL>'
    },
    { label: 'Bridge $20 USDC to Polygon', prompt: 'bridge $20 USDC from Base to Polygon' },
    { label: 'Show my positions', prompt: 'show my positions' },
    { label: 'Status', prompt: 'status' },
    { label: 'Revoke spend permission', prompt: 'revoke spend permission' },
    { label: 'Explain last order', prompt: 'explain last order' }
  ];
  const onSuggestion = (prompt: string) => {
    setInput(prompt);
    try {
      if (inputRef.current) inputRef.current.focus();
    } catch {}
  };

  // Determine if the input/button should be disabled
  const isDisabled = isLoading || !isWalletConnected;
  const placeholderText = !isWalletConnected ? 'Connect wallet to chat' : 'Send a message...';

  // Scroll to bottom when messages change or loading state finishes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading, scrollAreaRef]); // Trigger scroll on new messages and when loading stops

  return (
    <div
      className="flex h-[100dvh] md:h-full min-h-0 flex-col items-center bg-white rounded-2xl overflow-hidden relative"
      style={{ boxShadow: '8px 8px 0px 0px #000000' }}
    >
      <div className="p-2 md:p-4 w-full max-w-none flex items-center flex-none">
        <Button
          variant="outline"
          className="hidden items-center justify-center h-auto py-2 px-4 border-2 border-black bg-blue hover:bg-blue/90 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-medium"
          style={{ boxShadow: '2px 2px 0px 0px #000000' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-hidden md:overflow-auto p-2 md:p-4 w-full max-w-none pb-24 md:pb-40"
      >
        <div className="space-y-4 w-full">
          {messages.length === 0 && (
            <div className="flex flex-col gap-4 my-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center border-2 border-black flex-shrink-0">
                  <Bot className="w-5 h-5 text-black" />
                </div>
                <div
                  className="max-w-[90%] p-3 rounded-lg border-2 border-black bg-white text-left"
                  style={{ boxShadow: '4px 4px 0px 0px #000000' }}
                >
                  <div className="text-sm">
                    <div className="font-semibold mb-1">gm, how can I help you?</div>
                    <div className="text-[12px] leading-6 text-gray-700 space-y-1">
                      {suggestions.map((s) => (
                        <div
                          key={s.label}
                          className="cursor-pointer select-none hover:opacity-80"
                          onClick={() => onSuggestion(s.prompt)}
                        >
                          {'>'} {s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  {!isWalletConnected && (
                    <p className="text-xs text-gray-500 mt-3">
                      Connect your wallet to enable actions.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {messages.map((message, index) => {
            console.log(`💬 Chat UI: Rendering message ${index}:`, message);

            // Determine alignment based on sender ('user' or 'assistant' from SDK)
            const isUser = message.role === 'user';
            const alignClass = isUser ? 'justify-end' : 'justify-start';
            const bubbleClass = isUser ? 'bg-blue text-black' : 'bg-white';
            const avatarSrc = isUser ? '/path/to/user/avatar.png' : '/txt-logo.png'; // Replace with actual user avatar if available
            const avatarFallback = isUser ? 'U' : 'AI';

            return (
              <div
                key={message.id || `msg-${index}`}
                className={`flex items-start gap-3 ${alignClass}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Bot className="w-5 h-5 text-black" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] p-3 rounded-lg border-2 border-black ${bubbleClass}`}
                  style={{ boxShadow: '4px 4px 0px 0px #000000' }}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{getMessageText(message)}</p>
                  ) : (
                    (() => {
                      const baseText = getMessageText(message);
                      const parsed = parseSpendPermissionTag(baseText);
                      const display = baseText;
                      const normalizedDisplay = normalizeMarkdown(display || '');
                      return (
                        <div className="markdown-content text-sm prose prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              p: ({ node, ...props }) => (
                                <p className="mb-2 last:mb-0" {...props} />
                              ),
                              a: ({ node, ...props }) => (
                                <a className="text-blue-600 underline" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul className="list-disc pl-5 mb-2" {...props} />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="list-decimal pl-5 mb-2" {...props} />
                              ),
                              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                              h1: ({ node, ...props }) => (
                                <h1 className="text-lg font-bold mb-2 mt-3" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-base font-bold mb-2 mt-3" {...props} />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 className="text-sm font-bold mb-1 mt-2" {...props} />
                              ),
                              code: ({ inline, className, ...props }: CodeProps) =>
                                inline ? (
                                  <code
                                    className="bg-gray-100 rounded px-1 py-0.5 text-xs"
                                    {...props}
                                  />
                                ) : (
                                  <code
                                    className="block bg-gray-100 rounded p-2 overflow-x-auto text-xs my-2"
                                    {...props}
                                  />
                                ),
                              pre: ({ node, ...props }) => (
                                <pre
                                  className="bg-gray-100 rounded p-0 overflow-x-auto text-xs my-2"
                                  {...props}
                                />
                              ),
                              blockquote: ({ node, ...props }) => (
                                <blockquote
                                  className="border-l-4 border-gray-300 pl-3 italic my-2"
                                  {...props}
                                />
                              ),
                              table: ({ node, ...props }) => (
                                <table
                                  className="border-collapse border border-gray-300 my-2 text-xs"
                                  {...props}
                                />
                              ),
                              th: ({ node, ...props }) => (
                                <th
                                  className="border border-gray-300 py-1 px-2 bg-gray-100"
                                  {...props}
                                />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="border border-gray-300 py-1 px-2" {...props} />
                              )
                            }}
                          >
                            {normalizedDisplay}
                          </ReactMarkdown>
                          {/* Spend permission buttons removed */}
                        </div>
                      );
                    })()
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center border-2 border-black flex-shrink-0">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div
                className="max-w-[70%] p-3 rounded-lg border-2 border-black bg-white"
                style={{ boxShadow: '4px 4px 0px 0px #000000' }}
              >
                <p className="text-sm animate-pulse">Thinking...</p>
              </div>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center border-2 border-black flex-shrink-0">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div
                className="max-w-[70%] p-3 rounded-lg border-2 border-black bg-red-50"
                style={{ boxShadow: '4px 4px 0px 0px #000000' }}
              >
                <p className="text-sm text-red-500">
                  Error: {error.message || 'Something went wrong'}
                </p>
                <p className="text-xs text-red-400 mt-1">
                  There was an error processing your request.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 flex items-center gap-1"
                  onClick={stop}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div
        className="fixed md:sticky inset-x-0 bottom-0 z-20 px-2 md:px-4 w-3/4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="w-full bg-white md:border-t-2 p-2 md:p-4 rounded-t-2xl">
          <form className="relative w-full" onSubmit={handleSubmit}>
            <Input
              type="text"
              placeholder={placeholderText}
              value={input}
              onChange={handleInputChange}
              disabled={isDisabled}
              className="pr-12 md:pr-16 py-4 md:py-6 text-base border-2 border-black rounded-xl"
              style={{ boxShadow: '4px 4px 0px 0px #000000' }}
              ref={inputRef as any}
            />
            <Button
              type="submit"
              disabled={isDisabled || !input.trim()}
              className="absolute right-2 top-2 md:top-2 bg-blue hover:bg-blue/90 text-black border-2 border-black rounded-xl h-9 w-9 p-0 flex items-center justify-center"
              style={{ boxShadow: '2px 2px 0px 0px #000000' }}
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
