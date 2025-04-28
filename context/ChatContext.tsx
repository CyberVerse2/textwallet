'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useDelegatedActions } from '@privy-io/react-auth'; // Import useDelegatedActions
import { supabase } from '@/lib/supabaseClient'; // Corrected import path
import { Message as SdkMessage, useChat, UseChatHelpers } from '@ai-sdk/react'; // Renamed import

// Define the structure matching the chat_history table
interface DbMessage {
  message_id: string; // Changed from id to match DB
  user_id: string; // Ensure this matches your table column if it exists
  sender: 'user' | 'ai';
  message: string; // Renamed from content to match DB schema
  created_at: string; // ISO string format
  parent_message_id?: string | null; // Add this field
}

interface ChatContextType {
  messages: SdkMessage[];
  input: UseChatHelpers['input'];
  handleInputChange: UseChatHelpers['handleInputChange'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  isLoading: UseChatHelpers['isLoading'];
  reload: UseChatHelpers['reload'];
  stop: UseChatHelpers['stop'];
  setInput: UseChatHelpers['setInput'];
  error: UseChatHelpers['error'];
  append: UseChatHelpers['append'];
  loadingHistory: boolean;
  isWalletConnected: boolean;
  setIsWalletConnected: (connected: boolean) => void;
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>; // For scrolling UI
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  // State for wallet connection
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageError, setMessageError] = useState<Error | null>(null);
  const [delegationAttempted, setDelegationAttempted] = useState(false); // Track delegation attempt

  const { user, authenticated, logout } = usePrivy(); // Keep usePrivy for auth state
  const { delegateWallet } = useDelegatedActions(); // Use useDelegatedActions for delegateWallet

  // Reset delegation attempt status on logout
  useEffect(() => {
    if (!authenticated) {
      setDelegationAttempted(false);
    }
  }, [authenticated]);

  // Initialize Vercel AI Chat with proper naming
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    reload,
    stop,
    error,
    setInput,
    setMessages,
    append
  } = useChat({
    api: '/api/chat', // Your backend endpoint
    id: user?.id ? `chat_${user.id}` : undefined, // Unique ID for the chat session
    body: {
      userId: user?.id, // Pass the authenticated user's ID
      walletId: user?.wallet?.id, // Pass the connected wallet address as walletId
    },
    onResponse: (response: Response) => { // Add type to response
      if (!response.ok) {
        console.error(' Chat History: [onResponse] Error response:', response.status, response.statusText);
      }
    },
    // REMOVED onFinish callback (saving is handled by API route)
    onError: (error: Error) => { // Add type to error parameter
      console.error(' Chat History: [onError] Vercel AI SDK error:', error);
    },
  });

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false);

  // Function to fetch chat history - useCallback to prevent re-creation
  const fetchChatHistory = useCallback(async (userId: string): Promise<SdkMessage[]> => {
    setLoadingHistory(true);
    try {
      const { data: dbMessages, error: dbError } = await supabase
        .from('chat_history')
        .select('message_id, user_id, sender, message, created_at, parent_message_id') // Ensure parent_message_id is selected
        .eq('user_id', userId)
        .order('created_at', { ascending: true }); // Fetch sorted by creation time

      if (dbError) throw dbError;
      if (!dbMessages) return [];

      // Process messages to group user prompts with AI responses
      const userMessagesMap = new Map<string, DbMessage>();
      const processedMessages: SdkMessage[] = [];

      // First pass: identify user messages
      for (const msg of dbMessages) {
        if (msg.sender === 'user') {
          userMessagesMap.set(msg.message_id, msg);
        }
      }

      // Second pass: group and order
      for (const msg of dbMessages) {
         if (msg.sender === 'user') {
           // Check if this user message has already been processed as part of a pair
           if (userMessagesMap.has(msg.message_id)) {
             processedMessages.push(convertSingleDbMessageToVercelFormat(msg));
             userMessagesMap.delete(msg.message_id); // Remove from map once added
           }
         } else if (msg.sender === 'ai') {
           const parentId = msg.parent_message_id;
           if (parentId && userMessagesMap.has(parentId)) {
             // Found parent, add user message first if not already added
             const parentMsg = userMessagesMap.get(parentId)!;
             processedMessages.push(convertSingleDbMessageToVercelFormat(parentMsg));
             userMessagesMap.delete(parentId); // Remove parent from map

             // Add AI message
             processedMessages.push(convertSingleDbMessageToVercelFormat(msg));
           } else {
             // AI message without a found parent (orphan or parent already processed)
             // Add it directly in its chronological spot
              processedMessages.push(convertSingleDbMessageToVercelFormat(msg));
           }
         }
      }

       // Add any remaining user messages from the map (those without AI replies)
       // This preserves chronological order because we iterated through dbMessages sorted by created_at
       userMessagesMap.forEach(userMsg => {
          processedMessages.push(convertSingleDbMessageToVercelFormat(userMsg));
       });

      // Re-sort final list just in case (optional, but safe)
      processedMessages.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));

      return processedMessages;

    } catch (err) {
      console.error(' Chat History: Error fetching/processing chat history:', err);
      return []; // Return empty array on error
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase]); // Keep dependencies

  // Effect to load history when user authenticates
  useEffect(() => {
    if (user?.id && !initialHistoryLoaded) {
      fetchChatHistory(user.id).then(history => {
        if (history.length > 0) {
          setMessages(history); // Update internal messages state with fetched history
        }
        setInitialHistoryLoaded(true); // Mark history as loaded
      });
    }
  }, [user, initialHistoryLoaded, fetchChatHistory, setMessages]); // Add fetchChatHistory and setMessages

  // Combine Vercel AI state with custom state
  const value = {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    reload,
    stop,
    setInput,
    error,
    append,
    loadingHistory,
    isWalletConnected,
    setIsWalletConnected,
    walletAddress,
    setWalletAddress,
    scrollAreaRef
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => { // Rename the exported hook
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

// Helper function to convert a single DB message to Vercel AI SDK format
const convertSingleDbMessageToVercelFormat = (msg: DbMessage): SdkMessage => {
    return {
        id: msg.message_id,
        content: msg.message,
        role: msg.sender === 'user' ? 'user' : 'assistant',
        createdAt: msg.created_at ? new Date(msg.created_at) : undefined,
        // Add other fields if needed by SdkMessage type, but these are primary
    };
};

// Helper function to convert DB messages to Vercel AI SDK format (Now less used directly by fetch)
const convertDbMessagesToVercelFormat = (dbMessages: DbMessage[]): SdkMessage[] => {
  return dbMessages.map(convertSingleDbMessageToVercelFormat); // Use the single converter
};

// Helper function to convert a single Vercel AI SDK message to DB format
const convertSdkToDbMessage = (msg: SdkMessage, userId: string): DbMessage | null => {
  // Add a check to ensure the message has an ID, which is needed for the DB schema
  if (!msg.id) {
    console.warn(' Chat History: [convertSdkToDbMessage] Skipping message without ID:', msg);
    return null;
  }
  return {
    message_id: msg.id,
    user_id: userId,
    sender: msg.role === 'user' ? 'user' : 'ai', // Map 'assistant' role to 'ai'
    message: msg.content, // Map SDK 'content' to DB 'message'
    created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
  };
};
