'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useChat as useVercelAIChat } from '@ai-sdk/react';
import { usePrivy } from '@privy-io/react-auth';

// Keep the original Message interface for compatibility with existing components
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

interface ChatContextType {
  messages: Message[];
  inputValue: string;
  walletAddress: string | null;
  setInputValue: (value: string) => void;
  sendMessage: (text: string) => Promise<void>;
  isProcessing: boolean;
  isWalletConnected: boolean;
  setIsWalletConnected: (connected: boolean) => void;
  setWalletAddress: (address: string | null) => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  error: Error | null;
  reload: () => void;
  stop: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  // State for wallet connection
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageError, setMessageError] = useState<Error | null>(null);

  const { user, authenticated } = usePrivy();

  // Initialize Vercel AI Chat with proper naming
  const {
    messages: vercelMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    reload,
    stop,
    error: vercelError
  } = useVercelAIChat({
    api: '/api/chat',
    initialMessages: [], 
    body: {
      // Always use the server wallet - no option to disable
      useWallet: true,
      // Pass the user identifier for wallet operations - use either Privy ID or wallet address
      userId: user?.id || walletAddress || null
    },
    onFinish: () => {
      console.log(" Chat message completed successfully");
      setMessageError(null);
    },
    onError: (error) => {
      console.error(" Chat error:", error);
      setMessageError(error);
    }
  });

  // Convert Vercel AI message format to our app's format
  const convertedMessages = vercelMessages.map((msg): Message => ({
    id: msg.id,
    text: msg.content,
    sender: msg.role === 'user' ? 'user' : 'bot'
  }));

  // Auto-scroll logic
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [convertedMessages]);

  // Create a wrapper for handleInputChange to maintain compatibility
  const setInputValue = useCallback((value: string) => {
    console.log(" Setting input value:", value);
    handleInputChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
  }, [handleInputChange]);

  // Handler for sending messages
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !isWalletConnected) {
      console.log(" Cannot send message:", {
        empty: !text.trim(),
        isLoading,
        isWalletConnected
      });
      return;
    }
    
    try {
      console.log(" Sending message:", text);
      console.log(" Using server wallet:", isWalletConnected);
      setMessageError(null);
      await append({
        content: text,
        role: 'user'
      });
      console.log(" Message sent successfully");
    } catch (error) {
      console.error(" Error sending message:", error);
      if (error instanceof Error) {
        setMessageError(error);
      } else {
        setMessageError(new Error("Failed to send message"));
      }
    }
  }, [append, isLoading, isWalletConnected]);

  // Clear chat on disconnect
  useEffect(() => {
    if (!isWalletConnected) {
      // We can't completely clear the chat with Vercel AI SDK,
      // but we can reset to initial state on next connection
      setWalletAddress(null);
    }
  }, [isWalletConnected]);

  // Update error state from Vercel's error
  useEffect(() => {
    if (vercelError) {
      console.error(" Vercel AI SDK error:", vercelError);
      setMessageError(vercelError);
    }
  }, [vercelError]);

  const value = {
    messages: convertedMessages,
    inputValue: input,
    walletAddress,
    setInputValue,
    sendMessage,
    isProcessing: isLoading,
    isWalletConnected,
    setIsWalletConnected,
    setWalletAddress,
    scrollAreaRef,
    error: messageError,
    reload,
    stop
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
