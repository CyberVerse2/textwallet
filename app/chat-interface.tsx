"use client"

import React from "react"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, User, Bot, Sparkles } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

const ChatInterface = () => {
  const { 
    messages, 
    inputValue, 
    setInputValue, 
    sendMessage, 
    isProcessing, 
    isWalletConnected,
    scrollAreaRef 
  } = useChat();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    sendMessage(inputValue);
  };

  const isDisabled = isProcessing || !isWalletConnected;
  const placeholderText = !isWalletConnected 
    ? "Connect your wallet to send commands..." 
    : "Ask me anything about your wallet...";

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl overflow-hidden relative" style={{ boxShadow: "8px 8px 0px 0px #000000" }}>
      <header className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-lg">Chat Assistant</h2>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
              {message.sender === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-yellow flex items-center justify-center border-2 border-black flex-shrink-0">
                  <Bot className="w-5 h-5 text-black" />
                </div>
              )}
              <div
                className={`max-w-[70%] p-3 rounded-lg border-2 border-black ${message.sender === 'user'
                  ? 'bg-yellow text-black ml-auto'
                  : 'bg-white'
                }`}
                style={{ boxShadow: "4px 4px 0px 0px #000000" }}
              >
                <p className="text-sm">{message.text}</p>
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
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-200 bg-white">
        <form className="relative" onSubmit={handleFormSubmit}> 
          <Input
            type="text"
            placeholder={placeholderText}
            className="w-full pr-12 h-12 border-2 border-black focus:ring-2 focus:ring-yellow focus:ring-offset-2 rounded-lg font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            value={inputValue} 
            onChange={handleInputChange}
            disabled={isDisabled} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
                e.preventDefault();
                handleFormSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-yellow text-black hover:bg-yellow/90 active:translate-y-px active:shadow-none transition-all duration-100 border-2 border-black rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "2px 2px 0px 0px #000000" }}
            disabled={isDisabled || !inputValue.trim()} 
          >
            {isProcessing ? (
                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div> 
            ) : (
                <Sparkles className="h-5 w-5" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
