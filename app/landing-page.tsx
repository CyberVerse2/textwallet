'use client';

import React from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useChat } from '@/context/ChatContext'; 
import { usePrivy } from '@privy-io/react-auth';

interface LandingPageProps {
  onStartChat: () => void;
}

const LandingPage = ({ onStartChat }: LandingPageProps) => {
  const { 
    inputValue, 
    setInputValue, 
    sendMessage, 
    isProcessing, 
    isWalletConnected
  } = useChat(); 
  
  // Use Privy hook to get login function and user info
  const { login, ready, user } = usePrivy();
  
  // Get user's name or default to "there" - removed Twitter reference to avoid API init issues
  const userName = user ? (
    user.email?.address ? user.email.address.split('@')[0] : 
    user.wallet?.address ? `${user.wallet.address.slice(0, 6)}...` : 'there'
  ) : 'there';

  const handleExampleClick = (prompt: string) => {
    if (!isProcessing && isWalletConnected) {
      sendMessage(prompt); 
      onStartChat();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value); 
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isProcessing && isWalletConnected) {
        sendMessage(inputValue); 
        onStartChat();
    }
  };

  const examplePrompts = [
    'Send ETH to vitalik.eth',
    'Show my NFTs',
    'BTC price?',
    'Swap ETH for USDC',
  ];

  const isDisabled = isProcessing || !isWalletConnected;
  const placeholderText = !isWalletConnected 
    ? "Connect your wallet to send commands..." 
    : "Type your command... e.g., Send 0.1 ETH to vitalik.eth";

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6">
      <div className="max-w-4xl w-full text-center mb-12 mx-auto">
        <div className="inline-flex items-center justify-center gap-3 mb-6 px-3 py-1.5 bg-yellow rounded-full">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shadow-[0_0_10px_rgba(255,222,0,0.7)]"></div>
          <span className="text-sm font-bold text-black">Powered by Base</span>
        </div>
        <h1 className="text-5xl font-bold mb-4">Welcome to Text Wallet</h1>
        <p className="text-xl text-muted-foreground">Your crypto wallet, controlled by text commands.</p>
      </div>

      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-row flex-wrap justify-center gap-4 mb-6 w-full px-4">
          {examplePrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              className="flex items-center justify-center h-auto py-2 px-4 border-2 border-black hover:bg-yellow/20 active:translate-y-px active:shadow-none transition-all duration-100 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ boxShadow: "2px 2px 0px 0px #000000" }}
              onClick={() => handleExampleClick(prompt)}
              disabled={isDisabled} 
            >
              <Sparkles className="h-3 w-3 mr-2 flex-shrink-0" />
              <span className="truncate">{prompt}</span>
            </Button>
          ))}
        </div>

        <form className="relative w-full max-w-3xl mx-auto px-4" onSubmit={handleSubmit}>
          <div className="relative">
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
                  handleSubmit(e);
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
                  <ArrowUp className="h-5 w-5" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      
      </div>
    </div>
  );
};

export default LandingPage;
