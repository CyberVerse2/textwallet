"use client"

import React, { useEffect, useRef } from "react"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Bot, Sparkles, ArrowLeft, RefreshCw } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { usePrivy } from '@privy-io/react-auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatInterfaceProps {
  onGoBack: () => void;
}

// Define type for code component props to fix TypeScript error
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const ChatInterface = ({ onGoBack }: ChatInterfaceProps) => {
  const { user } = usePrivy();
  const prevMessagesLengthRef = useRef<number>(0);
  const prevInputRef = useRef<string>('');
  const prevIsProcessingRef = useRef<boolean>(false);
  
  // Use the existing ChatContext instead of direct AI SDK
  const { 
    messages, 
    inputValue, 
    setInputValue, 
    sendMessage, 
    isProcessing,
    isWalletConnected,
    walletAddress,
    scrollAreaRef,
    error
  } = useChat();
  
  // Log state changes to see what's happening
  useEffect(() => {
    // Check if messages changed
    if (messages.length !== prevMessagesLengthRef.current) {
      console.log('💬 Chat UI: Messages updated', {
        count: messages.length,
        previousCount: prevMessagesLengthRef.current,
        newMessages: messages.slice(prevMessagesLengthRef.current)
      });
      prevMessagesLengthRef.current = messages.length;
    }
    
    // Check if input changed
    if (inputValue !== prevInputRef.current) {
      console.log('💬 Chat UI: Input changed', { 
        from: prevInputRef.current, 
        to: inputValue 
      });
      prevInputRef.current = inputValue;
    }
    
    // Check if loading state changed
    if (isProcessing !== prevIsProcessingRef.current) {
      console.log('💬 Chat UI: Loading state changed', { 
        from: prevIsProcessingRef.current, 
        to: isProcessing 
      });
      prevIsProcessingRef.current = isProcessing;
    }
  }, [messages, inputValue, isProcessing]);
  
  // Log errors when they occur
  useEffect(() => {
    if (error) {
      console.error('💬 Chat UI: Error from context:', error);
    }
  }, [error]);
  
  // Convert the chat context's sendMessage to work with our form
  const onFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('💬 Chat UI: Form submitted with input:', inputValue);
    
    try {
      console.log('💬 Chat UI: Calling sendMessage...');
      await sendMessage(inputValue);
      console.log('💬 Chat UI: sendMessage completed');
    } catch (e) {
      console.error('💬 Chat UI: Error in form submission', e);
    }
  };

  // Function to retry the last message
  const handleRetry = async () => {
    console.log('💬 Chat UI: Retry button clicked');
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
      if (lastUserMessage && !isProcessing) {
        try {
          console.log('💬 Chat UI: Retrying message:', lastUserMessage.text);
          await sendMessage(lastUserMessage.text);
        } catch (e) {
          console.error('💬 Chat UI: Error in retry', e);
        }
      }
    }
  };

  // Determine if input should be disabled - no connection or loading
  const isDisabled = isProcessing || !isWalletConnected;
  
  useEffect(() => {
    console.log('💬 Chat UI: Wallet connection status', { 
      isWalletConnected, 
      walletAddress: user?.wallet?.address 
    });
  }, [isWalletConnected, user?.wallet?.address]);
  
  const placeholderText = !isWalletConnected 
    ? "Connect your wallet to send commands..." 
    : "Ask me anything about your wallet...";

  return (
    <div className="flex-1 flex flex-col items-center bg-white rounded-2xl overflow-hidden relative" style={{ boxShadow: "8px 8px 0px 0px #000000" }}>
      <div className="p-4 w-full max-w-[50rem] flex items-center">
        <Button 
          variant="outline"
          onClick={() => {
            console.log('💬 Chat UI: Go back button clicked');
            onGoBack();
          }}
          className="flex items-center justify-center h-auto py-2 px-4 border-2 border-black bg-yellow hover:bg-yellow/90 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-medium"
          style={{ boxShadow: "2px 2px 0px 0px #000000" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 w-full max-w-[33rem]">
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
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}
            >
              {message.sender === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                  <Bot className="w-5 h-5 text-black" />
                </div>
              )}
              <div
                className={`max-w-[90%] p-3 rounded-lg border-2 border-black ${message.sender === 'user'
                  ? 'bg-yellow text-black ml-auto'
                  : 'bg-white'
                }`}
                style={{ boxShadow: "4px 4px 0px 0px #000000" }}
              >
                {message.sender === 'user' ? (
                  <p className="text-sm">{message.text}</p>
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
                      {message.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {message.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 border-black flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
              )}
            </div>
          ))}
          {isProcessing && (
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                    <Bot className="w-5 h-5 text-black" />
                </div>
                <div className="max-w-[70%] p-3 rounded-lg border-2 border-black bg-white" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <p className="text-sm animate-pulse">Thinking...</p> 
                </div>
            </div>
          )}
          {error && !isProcessing && (
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
                      onClick={handleRetry}
                      disabled={isProcessing}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </Button>
                </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-white w-full max-w-[33rem]">
        <form className="relative w-full" onSubmit={onFormSubmit}> 
          <Input
            type="text"
            placeholder={placeholderText}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isDisabled}
            className="pr-16 py-6 text-base border-2 border-black rounded-xl"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          />
          <Button 
            type="submit"
            disabled={isDisabled || !inputValue.trim()}
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
