'use client';

import React from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { useChat } from '@/context/ChatContext'; 

interface LandingPageProps {
}

const LandingPage = () => {
  const { 
    inputValue, 
    setInputValue, 
    sendMessage, 
    isProcessing, 
    isWalletConnected 
  } = useChat(); 

  const handleExampleClick = (prompt: string) => {
    if (!isProcessing && isWalletConnected) {
      sendMessage(prompt); 
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
    }
  };

  const examplePrompts = [
    'Send 1 ETH to vitalik.eth',
    'Show me my NFT collection',
    'What is the price of Bitcoin?',
    'Swap 0.5 WETH for USDC',
  ];

  const isDisabled = isProcessing || !isWalletConnected;
  const placeholderText = !isWalletConnected 
    ? "Connect your wallet to send commands..." 
    : "Type your command... e.g., Send 0.1 ETH to vitalik.eth";

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6">
      <div className="max-w-2xl w-full text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">Welcome to Text Wallet</h1>
        <p className="text-xl text-muted-foreground">Your crypto wallet, controlled by text commands.</p>
      </div>

      <div className="w-full max-w-md">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {examplePrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              className="text-left justify-start h-auto py-2 border-2 border-black hover:bg-yellow/20 active:translate-y-px active:shadow-none transition-all duration-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: "2px 2px 0px 0px #000000" }}
              onClick={() => handleExampleClick(prompt)}
              disabled={isDisabled} 
            >
              {prompt}
            </Button>
          ))}
        </div>

        <form className="relative" onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder={placeholderText}
            className="w-full pr-12 h-12 border-2 border-black focus:ring-2 focus:ring-yellow focus:ring-offset-2 rounded-lg font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            value={inputValue} 
            onChange={handleInputChange}
            disabled={isDisabled} 
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-yellow text-black hover:bg-yellow/90 active:translate-y-px active:shadow-none transition-all duration-100 border-2 border-black rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "2px 2px 0px 0px #000000" }}
            disabled={isDisabled || !inputValue.trim()} 
          >
            <ArrowUp className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
         {!isWalletConnected && (
           <p className="text-center text-sm text-red-600 mt-2">Please connect your wallet in the sidebar to send commands.</p>
         )}
      </div>
    </div>
  );
};

export default LandingPage;
