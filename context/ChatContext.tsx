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
  id: string; // Use 'id' to match default Supabase primary key
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
        .select('id, user_id, sender, message, created_at, parent_message_id') // Select 'id'
        .eq('user_id', userId)
        .order('created_at', { ascending: true }); // Fetch sorted by creation time

      if (dbError) throw dbError;

      console.log(" Chat History: Raw data from Supabase:", dbMessages);

      if (!dbMessages || dbMessages.length === 0) return [];

      const messageMap = new Map<string, SdkMessage>();
      const childrenMap = new Map<string, string[]>();
      const addedMessageIds = new Set<string>();
      const result: SdkMessage[] = [];

      // First pass: Convert all messages and map children
      for (const dbMsg of dbMessages) {
        const sdkMsg = convertSingleDbMessageToVercelFormat(dbMsg);
        messageMap.set(sdkMsg.id, sdkMsg);

        if (dbMsg.parent_message_id) {
          if (!childrenMap.has(dbMsg.parent_message_id)) {
            childrenMap.set(dbMsg.parent_message_id, []);
          }
          childrenMap.get(dbMsg.parent_message_id)!.push(sdkMsg.id); // Store sdkMsg.id
        }
      }

      // Second pass: Build the result array ensuring pairs are together
      for (const dbMsg of dbMessages) {
        const currentMsgId = dbMsg.id; // Use DB ID for lookups

        // Skip if already added as part of a pair
        if (addedMessageIds.has(currentMsgId)) {
          continue;
        }

        const sdkMsg = messageMap.get(currentMsgId);
        if (!sdkMsg) continue; // Should not happen if first pass worked

        if (sdkMsg.role === 'user') {
          // Add user message
          result.push(sdkMsg);
          addedMessageIds.add(currentMsgId);

          // Add its direct children (AI responses)
          const childIds = childrenMap.get(currentMsgId); // Look up using currentMsgId (DB id)
          if (childIds) {
            for (const childId of childIds) {
              const childMsg = messageMap.get(childId);
              if (childMsg && !addedMessageIds.has(childId)) { // Check addedMessageIds using childId (SdkMessage id)
                result.push(childMsg);
                addedMessageIds.add(childId); // Add childId (SdkMessage id)
              }
            }
          }
        } else if (sdkMsg.role === 'assistant' && !dbMsg.parent_message_id) {
          // Add orphan AI message (e.g., initial greeting not linked to user)
          result.push(sdkMsg);
          addedMessageIds.add(currentMsgId); // Add currentMsgId (DB id)
        }
        // AI messages with parents are handled when their parent user message is processed.
      }

      return result;

    } catch (err) {
      console.error(' Chat History: Error fetching/processing chat history:', err);
      return []; // Return empty array on error
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase]); // Keep dependencies

  // Helper function to convert DB message format to Vercel SDK format
  function convertSingleDbMessageToVercelFormat(dbMsg: DbMessage): SdkMessage {
    return {
      id: dbMsg.id, // Map dbMsg.id to SdkMessage.id
      role: dbMsg.sender === 'ai' ? 'assistant' : 'user',
      content: dbMsg.message,
      createdAt: new Date(dbMsg.created_at),
    };
  }

  // Effect to load history when user authenticates
  useEffect(() => {
    if (user?.id && !initialHistoryLoaded) {
      fetchChatHistory(user.id).then(history => {
        console.log(" Chat History: Fetched history array:", history); // Log fetched history
        setMessages(history); // Overwrite initial state from useChat with DB history
        console.log(" Chat History: Called setMessages with fetched history."); // Log confirmation
        setInitialHistoryLoaded(true); // Mark history as loaded
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initialHistoryLoaded, fetchChatHistory]); // Removed setMessages from deps

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
