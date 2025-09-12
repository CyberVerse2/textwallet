"use client"

import React, { useEffect, useRef, useState } from "react"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Bot, Sparkles, ArrowLeft, RefreshCw } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatInterfaceProps {
}

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
    // Custom context values
    isWalletConnected,
    walletAddress,
    scrollAreaRef
  } = useChatContext();
  
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
  const placeholderText = !isWalletConnected ? "Connect wallet to chat" : "Send a message...";
 
  // Scroll to bottom when messages change or loading state finishes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading, scrollAreaRef]); // Trigger scroll on new messages and when loading stops

  return (
    <div className="flex-1 flex flex-col items-center bg-white rounded-2xl overflow-hidden relative" style={{ boxShadow: "8px 8px 0px 0px #000000" }}>
      <div className="p-4 w-full max-w-[50rem] flex items-center">
        <Button 
          variant="outline"
          className="hidden items-center justify-center h-auto py-2 px-4 border-2 border-black bg-yellow hover:bg-yellow/90 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-medium"
          style={{ boxShadow: "2px 2px 0px 0px #000000" }}
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
                  : 'Connect your wallet to get started with TextWallet'
                }
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
              <div key={message.id || `msg-${index}`} className={`flex items-start gap-3 ${alignClass}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Bot className="w-5 h-5 text-black" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] p-3 rounded-lg border-2 border-black ${bubbleClass}`}
                  style={{ boxShadow: "4px 4px 0px 0px #000000" }}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <div className="markdown-content text-sm prose prose-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          // Custom components for better formatting
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-600 underline" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-2" {...props} />,
                          code: ({inline, className, ...props}: CodeProps) => 
                            inline 
                              ? <code className="bg-gray-100 rounded px-1 py-0.5 text-xs" {...props} />
                              : <code className="block bg-gray-100 rounded p-2 overflow-x-auto text-xs my-2" {...props} />,
                          pre: ({node, ...props}) => <pre className="bg-gray-100 rounded p-0 overflow-x-auto text-xs my-2" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                          table: ({node, ...props}) => <table className="border-collapse border border-gray-300 my-2 text-xs" {...props} />,
                          th: ({node, ...props}) => <th className="border border-gray-300 py-1 px-2 bg-gray-100" {...props} />,
                          td: ({node, ...props}) => <td className="border border-gray-300 py-1 px-2" {...props} />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
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
                <div className="max-w-[70%] p-3 rounded-lg border-2 border-black bg-white" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <p className="text-sm animate-pulse">Thinking...</p> 
                </div>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Bot className="w-5 h-5 text-black" />
                </div>
                <div className="max-w-[70%] p-3 rounded-lg border-2 border-black bg-red-50" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <p className="text-sm text-red-500">Error: {error.message || "Something went wrong"}</p> 
                    <p className="text-xs text-red-400 mt-1">There was an error processing your request.</p>
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
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          />
          <Button 
            type="submit"
            disabled={isDisabled || !input.trim()}
            className="absolute right-2 top-2 bg-yellow hover:bg-yellow/90 text-black border-2 border-black rounded-xl h-9 w-9 p-0 flex items-center justify-center"
            style={{ boxShadow: "2px 2px 0px 0px #000000" }}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
