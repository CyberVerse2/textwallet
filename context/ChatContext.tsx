'use client';

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react';
import { useChat as useVercelAIChat, type UseChatOptions, type Message as VercelMessage } from '@ai-sdk/react';
import { usePrivy } from '@privy-io/react-auth';
import { useDelegatedActions } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';

// Keep the original Message interface for compatibility with existing components
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'txt';
  description?: string;
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
  const [delegationAttempted, setDelegationAttempted] = useState(false); // Track delegation attempt

  const { user, authenticated } = usePrivy();
  const { delegateWallet } = useDelegatedActions();

  // Reset delegation attempt status on logout
  useEffect(() => {
    if (!authenticated) {
      setDelegationAttempted(false);
    }
  }, [authenticated]);

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
      // Pass the user identifier (Privy DID)
      userId: user?.id || null,
      // Fetch and send the specific wallet ID as walletId
      walletId: user?.wallet?.id || null
    },
    onFinish: async (message: VercelMessage) => {
      console.log(' Chat History: [onFinish] Triggered. Bot message received:', message);
      setMessageError(null);

      // --- Save Chat History --- 
      console.log(' Chat History: [onFinish] Attempting to save history...');
      if (user?.id) {
        console.log(' Chat History: [onFinish] User authenticated with ID:', user.id);
        // Get the last user message and the new bot message
        const lastUserMessage = convertedMessages[convertedMessages.length - 1];
        const newBotMessage: Message = { 
          id: message.id, 
          text: message.content, 
          sender: 'txt' 
        };

        console.log(' Chat History: [onFinish] Identified lastUserMessage:', lastUserMessage);
        console.log(' Chat History: [onFinish] Identified newBotMessage:', newBotMessage);

        if (lastUserMessage && lastUserMessage.sender === 'user' && newBotMessage) {
          // Prepare data for Supabase insertion
          const messagesToSave = [
            {
              user_id: user.id,
              message: lastUserMessage.text,
              sender: 'user', // Use 'user' for DB
              // id: lastUserMessage.id // Optional: If you want to store Vercel AI SDK ID
            },
            {
              user_id: user.id,
              message: newBotMessage.text,
              sender: 'ai', // Use 'ai' for DB
              id: newBotMessage.id // Store Vercel AI SDK ID for the bot message
            }
          ];

          console.log(' Chat History: [onFinish] Payload to save:', JSON.stringify(messagesToSave));
          try {
            console.log(' Chat History: [onFinish] Calling supabase.insert...');
            const { error: insertError } = await supabase
              .from('chat_history')
              .insert(messagesToSave);

            if (insertError) {
              console.error(' Chat History: [onFinish] Supabase insert error:', insertError);
              throw insertError;
            }
            console.log(' Chat History: [onFinish] Messages saved successfully.');
          } catch (error) {
            console.error(' Chat History: [onFinish] Generic save error caught:', error);
            // Optional: Set an error state or notify the user
          }
        } else {
          console.warn(' Chat History: [onFinish] Skipping save: Conditions not met (lastUserMessage valid? Bot message valid?)');
        }
      } else {
        console.warn(' Chat History: [onFinish] Skipping save: User ID not available.');
      }
    },
    onError: (error) => {
      console.error(' Chat error:', error);
      setMessageError(error);
    }
  });

  // Convert Vercel AI message format to our app's format
  // Use useMemo to prevent unnecessary recalculations
  const convertedMessages = useMemo(() => {
    return vercelMessages.map(
      (msg): Message => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role === 'user' ? 'user' : 'txt'
      })
    );
  }, [vercelMessages]);

  // Fetch chat history from Supabase
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [initialHistory, setInitialHistory] = useState<Message[]>([]);

  useEffect(() => {
    const fetchAndSetHistory = async () => {
      if (authenticated && user?.id) {
        setHistoryLoading(true);
        setHistoryError(null);
        console.log(' Chat History: Fetching for user:', user.id);
        try {
          // Fetch history from Supabase
          const { data, error } = await supabase
            .from('chat_history')
            .select('id, message, sender, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (error) {
            throw error;
          }

          // Define expected row type
          type ChatHistoryRow = {
            id: string;
            message: string;
            sender: 'user' | 'ai';
            created_at: string;
          };

          // Map Supabase data to our Message format
          const fetchedMessages: Message[] = (data || []).map((row: ChatHistoryRow) => ({
            id: row.id, // Use Supabase ID
            text: row.message,
            sender: row.sender === 'ai' ? 'txt' : 'user', // Map 'ai' to 'txt'
          }));

          console.log(' Chat History: Fetched messages:', fetchedMessages);
          setInitialHistory(fetchedMessages);
        } catch (error) {
          console.error(' Chat History: Fetch error:', error);
          // Check if error is an instance of Error before setting state
          if (error instanceof Error) {
            setHistoryError(error);
          } else {
            setHistoryError(new Error('An unknown error occurred while fetching history.'));
          }
        } finally {
          setHistoryLoading(false);
        }
      }
    };

    fetchAndSetHistory();
  }, [authenticated, user]);

  // Create a wrapper for handleInputChange to maintain compatibility
  const setInputValue = useCallback(
    (value: string) => {
      console.log(' Setting input value:', value);
      handleInputChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    },
    [handleInputChange]
  );

  // Handler for sending messages
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !isWalletConnected) {
        console.log(' Cannot send message:', {
          empty: !text.trim(),
          isLoading,
          isWalletConnected
        });
        return;
      }

      try {
        console.log(' Sending message:', text);
        console.log(' Using server wallet:', isWalletConnected);
        setMessageError(null);
        await append({
          content: text,
          role: 'user'
        });
        console.log(' Message sent successfully');
      } catch (error) {
        console.error(' Error sending message:', error);
        if (error instanceof Error) {
          setMessageError(error);
        } else {
          setMessageError(new Error('Failed to send message'));
        }
      }
    },
    [append, isLoading, isWalletConnected, user?.id, user?.wallet?.id]
  );

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
      console.error(' Vercel AI SDK error:', vercelError);
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
