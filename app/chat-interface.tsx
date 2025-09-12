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
    // Custom context values
    isWalletConnected,
    walletAddress,
    scrollAreaRef
  } = useChatContext();

  const [isActing, setIsActing] = useState(false);
  const triggeredIdsRef = useRef<Set<string>>(new Set());

  function parseSpendPermissionTag(content: string) {
    const re =
      /\[ACTION:REQUEST_SPEND_PERMISSION\s+budgetUSD=(\d+(?:\.\d+)?)\s+periodDays=(\d+)\s+token=([^\]]+)\]/;
    const m = content.match(re);
    if (!m) return null;
    const budgetUSD = parseFloat(m[1]);
    const periodDays = parseInt(m[2], 10);
    const token = m[3];
    const cleaned = content.replace(re, '').trim();
    return { budgetUSD, periodDays, token, cleaned };
  }

  function normalizeMarkdown(s: string) {
    if (!s) return s;
    // Ensure headings start on a new line
    let out = s.replace(/([^\n])(#\s)/g, '$1\n$2');
    // Ensure a blank line before top-level headings for better rendering
    out = out.replace(/\n(#\s)/g, '\n\n$1');
    return out;
  }

  function parseTriggerTag(content: string) {
    const re =
      /\[ACTION:TRIGGER_SPEND_PERMISSION(?:\s+budgetUSD=(\d+(?:\.\d+)?))?(?:\s+periodDays=(\d+))?\]/;
    const m = content.match(re);
    if (!m) return null;
    const budgetUSD = m[1] ? parseFloat(m[1]) : undefined;
    const periodDays = m[2] ? parseInt(m[2], 10) : undefined;
    return { budgetUSD, periodDays };
  }

  async function onConfirmSpendPermission(
    budgetUSD: number,
    periodDays: number,
    pendingTrade: boolean
  ) {
    if (!walletAddress) return;
    try {
      setIsActing(true);
      // 1) Set budget
      await fetch('/api/budget/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: walletAddress, amountCents: Math.round(budgetUSD * 100) })
      });
      try {
        localStorage.setItem('tw_budget_usd', String(budgetUSD));
      } catch {}
      // 2) Fetch spender (CDP server wallet address)
      const addrRes = await fetch('/api/cdp/account');
      const addrJson = await addrRes.json();
      const spender = addrJson.address as string;
      const tokenAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
      // 3) Request spend permission via Base Account SDK (client only)
      const { createBaseAccountSDK } = await import('@base-org/account');
      const { requestSpendPermission } = await import('@base-org/account/spend-permission');
      const sdk = createBaseAccountSDK({ appName: 'Text Wallet' });
      const allowance = BigInt(Math.round(budgetUSD * 1_000_000));
      const permission: any = await requestSpendPermission({
        account: walletAddress,
        spender,
        token: tokenAddress,
        chainId: 8453,
        allowance,
        periodInDays: periodDays,
        provider: sdk.getProvider()
      } as any);
      // 4) Store permission server-side
      await fetch('/api/spend-permission/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: walletAddress,
          permissionHash: permission?.hash,
          permission,
          token: tokenAddress,
          allowance: Number(allowance.toString()),
          periodSeconds: periodDays * 86400
        })
      });
      try {
        await append({
          role: 'assistant',
          content: pendingTrade
            ? `✅ Budget set to $${budgetUSD} and spend permission enabled for ${periodDays} days. Proceeding with your trade…`
            : `✅ Budget set to $${budgetUSD} and spend permission enabled for ${periodDays} days.`
        });
      } catch {}
    } catch (e) {
      console.error('Spend permission flow failed:', e);
      try {
        await append({
          role: 'assistant',
          content: '❌ Spend permission setup failed or was rejected.'
        });
      } catch {}
    } finally {
      setIsActing(false);
    }
  }

  // Auto-trigger spend permission when assistant outputs [ACTION:TRIGGER_SPEND_PERMISSION]
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (triggeredIdsRef.current.has(last.id || String(messages.length))) return;
    const parsed = parseTriggerTag(last.content || '');
    if (!parsed) return;
    let budget = parsed.budgetUSD;
    if (budget == null) {
      try {
        const cached = localStorage.getItem('tw_budget_usd');
        if (cached) budget = parseFloat(cached);
      } catch {}
    }
    const period = parsed.periodDays ?? 7;
    const likelyPending = /order|trade|proceed/i.test(last.content || '');
    if (budget && !isActing) {
      triggeredIdsRef.current.add(last.id || String(messages.length));
      onConfirmSpendPermission(budget, period, likelyPending);
    }
  }, [messages, isActing]);

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
      className="flex-1 flex flex-col items-center bg-white rounded-2xl overflow-hidden relative"
      style={{ boxShadow: '8px 8px 0px 0px #000000' }}
    >
      <div className="p-4 w-full max-w-[50rem] flex items-center">
        <Button
          variant="outline"
          className="hidden items-center justify-center h-auto py-2 px-4 border-2 border-black bg-yellow hover:bg-yellow/90 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-medium"
          style={{ boxShadow: '2px 2px 0px 0px #000000' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 w-full max-w-[46rem]">
        <div className="space-y-4 w-full">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 my-8">
              <p>No messages yet. Start a conversation!</p>
              <p className="text-xs mt-2">
                {isWalletConnected
                  ? 'Your wallet is connected. Ask any crypto-related question!'
                  : 'Connect your wallet to get started with TextWallet'}
              </p>
            </div>
          )}
          {messages.map((message, index) => {
            console.log(`💬 Chat UI: Rendering message ${index}:`, message);

            // Determine alignment based on sender ('user' or 'assistant' from SDK)
            const isUser = message.role === 'user';
            const alignClass = isUser ? 'justify-end' : 'justify-start';
            const bubbleClass = isUser ? 'bg-yellow text-black' : 'bg-white';
            const avatarSrc = isUser ? '/path/to/user/avatar.png' : '/txt-logo.png'; // Replace with actual user avatar if available
            const avatarFallback = isUser ? 'U' : 'AI';

            return (
              <div
                key={message.id || `msg-${index}`}
                className={`flex items-start gap-3 ${alignClass}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Bot className="w-5 h-5 text-black" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] p-3 rounded-lg border-2 border-black ${bubbleClass}`}
                  style={{ boxShadow: '4px 4px 0px 0px #000000' }}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    (() => {
                      const parsed = parseSpendPermissionTag(message.content || '');
                      const display = parsed?.cleaned ?? message.content;
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
                          {parsed && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                variant="outline"
                                className="border-2 border-black"
                                disabled={isActing}
                                onClick={() =>
                                  onConfirmSpendPermission(
                                    parsed.budgetUSD,
                                    parsed.periodDays,
                                    /order|trade|proceed/i.test(display || '')
                                  )
                                }
                              >
                                Confirm
                              </Button>
                              <Button
                                variant="outline"
                                className="border-2 border-black"
                                disabled={isActing}
                                onClick={async () => {
                                  try {
                                    await append({
                                      role: 'assistant',
                                      content: '👍 Spend permission request cancelled.'
                                    });
                                  } catch {}
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
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
              <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
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
              <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
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

      <div className="p-4 bg-white w-full max-w-[46rem]">
        <form className="relative w-full" onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder={placeholderText}
            value={input}
            onChange={handleInputChange}
            disabled={isDisabled}
            className="pr-16 py-6 text-base border-2 border-black rounded-xl"
            style={{ boxShadow: '4px 4px 0px 0px #000000' }}
          />
          <Button
            type="submit"
            disabled={isDisabled || !input.trim()}
            className="absolute right-2 top-2 bg-yellow hover:bg-yellow/90 text-black border-2 border-black rounded-xl h-9 w-9 p-0 flex items-center justify-center"
            style={{ boxShadow: '2px 2px 0px 0px #000000' }}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
