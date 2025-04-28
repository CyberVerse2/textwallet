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
  message_id: string;
  user_id: string; // Ensure this matches your table column if it exists
  sender: 'user' | 'ai';
  content: string;
  created_at: string; // ISO string format
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
      // Pass data if needed
    },
    onResponse: (response: Response) => { // Add type to response
      if (!response.ok) {
        console.error(' Chat History: [onResponse] Error response:', response.status, response.statusText);
      }
    },
    onFinish: async (message: SdkMessage) => { // Add type to message
      console.log(' Chat History: [onFinish] Triggered. Bot message received:', message);
      setMessageError(null);

      // Find the user message that preceded this assistant response
      const userMessageFromSdk = messages.findLast(m => m.role === 'user');
      const botMessageFromSdk = message; // The AI response passed to onFinish

      console.log(' Chat History: [onFinish] Found user message from state:', userMessageFromSdk);
      console.log(' Chat History: [onFinish] Bot message from arg:', botMessageFromSdk);

      // Ensure we have both messages and the user is authenticated
      if (user?.id && userMessageFromSdk && botMessageFromSdk && botMessageFromSdk.role === 'assistant') {
        console.log(' Chat History: [onFinish] User authenticated with ID:', user.id);

        // Convert SDK messages to DB format
        const userMessageForDb = convertSdkToDbMessage(userMessageFromSdk, user.id);
        const botMessageForDb = convertSdkToDbMessage(botMessageFromSdk, user.id);

        console.log(` Chat History: [onFinish] Checking save condition: userMessageForDb valid? ${!!userMessageForDb}, user sender === 'user'? ${userMessageForDb?.sender === 'user'}, botMessageForDb role === 'ai'? ${botMessageForDb?.sender === 'ai'}`);

        // Prepare data for Supabase insertion
        const messagesToSave = [
          userMessageForDb,
          botMessageForDb
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
    },
    onError: (error: Error) => { // Add type to error parameter
      console.error(' Chat History: [onError] Vercel AI SDK error:', error);
    },
  });

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false);

  // Function to fetch chat history - useCallback to prevent re-creation
  const fetchChatHistory = useCallback(async (userId: string): Promise<SdkMessage[]> => {
    console.log(' Chat History: Fetching history for user:', userId);
    setLoadingHistory(true);
    try {
      const { data, error: dbError } = await supabase
        .from('chat_history')
        .select('*') // Select all needed fields (message_id, content, sender, created_at)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;

      if (data) {
        console.log(' Chat History: Fetched raw history:', data);
        // Ensure data matches DbMessage structure before conversion
        const formattedMessages = convertDbMessagesToVercelFormat(data as DbMessage[]);
        console.log(' Chat History: Formatted history for useChat:', formattedMessages);
        return formattedMessages;
      } else {
        console.log(' Chat History: No history found for user.');
        return [];
      }
    } catch (err) {
      console.error(' Chat History: Error fetching chat history:', err);
      // Handle error appropriately, maybe set an error state in context?
      return [];
    } finally {
      setLoadingHistory(false);
      console.log(' Chat History: Finished fetching history.');
    }
  }, [supabase]); // Add supabase as dependency

  // Effect to load history when user authenticates
  useEffect(() => {
    if (user?.id && !initialHistoryLoaded) {
      console.log(' Chat History: User authenticated, loading initial history...');
      fetchChatHistory(user.id).then(history => {
        if (history.length > 0) {
          console.log(' Chat History: Setting initial messages from fetched history:', history);
          setMessages(history); // Update internal messages state with fetched history
        } else {
          console.log(' Chat History: No initial history found, starting fresh.');
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

// Helper function to convert DB messages to Vercel AI SDK format
const convertDbMessagesToVercelFormat = (dbMessages: DbMessage[]): SdkMessage[] => {
  return dbMessages.map((msg): SdkMessage => ({
    id: msg.message_id, // Use message_id from DB as the id for SDK
    content: msg.content,
    role: msg.sender === 'user' ? 'user' : 'assistant', // Map 'ai' to 'assistant'
    createdAt: msg.created_at ? new Date(msg.created_at) : undefined,
  }));
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
    content: msg.content,
    created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
  };
};
