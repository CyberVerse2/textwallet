'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

interface ChatContextType {
  messages: Message[];
  inputValue: string;
  walletAddress: string | null; // Add wallet address state
  setInputValue: (value: string) => void;
  sendMessage: (text: string) => Promise<void>;
  isProcessing: boolean;
  isWalletConnected: boolean; // Added wallet connection status
  setIsWalletConnected: (connected: boolean) => void; // Setter for wallet status (for simulation/actual integration)
  setWalletAddress: (address: string | null) => void; // Setter for wallet address
  scrollAreaRef: React.RefObject<HTMLDivElement | null>; // Allow null
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Default to false
  const [walletAddress, setWalletAddress] = useState<string | null>(null); // State for wallet address
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  // Add welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: 'welcome-message',
        text: 'Welcome to Text Wallet! How can I help you today? Connect your wallet to get started.',
        sender: 'bot',
      },
    ]);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isProcessing || !isWalletConnected) return; // Check wallet connection

    const newUserMessage: Message = { id: Date.now().toString(), text: trimmedText, sender: 'user' };

    setIsProcessing(true);
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue(''); // Clear input after sending

    // --- Mock Bot Response --- (Replace with actual API call)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `"${trimmedText}"`, // Simple echo
        sender: 'bot',
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, something went wrong.',
        sender: 'bot',
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsProcessing(false);
    }
    // --- End Mock Bot Response ---
  }, [isProcessing, isWalletConnected]); // Add dependencies

  // Clear chat on disconnect
  useEffect(() => {
    if (!isWalletConnected) {
      setMessages([]); // Clear messages when wallet disconnects
      setWalletAddress(null); // Clear address too
    }
  }, [isWalletConnected]);

  const value = {
    messages,
    inputValue,
    walletAddress, // Provide address
    setInputValue,
    sendMessage,
    isProcessing,
    isWalletConnected,
    setIsWalletConnected,
    setWalletAddress, // Provide address setter
    scrollAreaRef,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
