'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
  JSX
} from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabaseClient'; // Corrected import path
import { UIMessage as SdkMessage, useChat } from '@ai-sdk/react';

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
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  reload: () => void;
  stop: () => void;
  setInput: (value: string) => void;
  error: Error | undefined;
  append: (message: { role: 'user'; content: string } | string) => void;
  setMessages: (messages: SdkMessage[] | ((m: SdkMessage[]) => SdkMessage[])) => void;
  loadingHistory: boolean;
  isWalletConnected: boolean;
  setIsWalletConnected: (connected: boolean) => void;
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>; // For scrolling UI
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }): JSX.Element {
  // State for wallet connection
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageError, setMessageError] = useState<Error | null>(null);
  const { address } = useAccount();

  // Derive wallet connection state from Wagmi account
  useEffect(() => {
    // Bootstrap from localStorage if wagmi address missing
    let effective = address ?? null;
    try {
      if (!effective) {
        const cached = localStorage.getItem('tw_address');
        if (cached) effective = cached as any;
      }
    } catch {}
    setIsWalletConnected(Boolean(effective));
    setWalletAddress(effective);
  }, [address]);

  // Initialize Vercel AI Chat with session-based ID so reload starts fresh
  const effectiveUserId = address || walletAddress || undefined;
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));

  const [input, setInput] = useState('');
  const { messages, status, error, sendMessage, setMessages, stop } = useChat({
    id: effectiveUserId ? `chat_${effectiveUserId.toLowerCase()}_${sessionId}` : undefined,
    // Start fresh per refresh; do not auto-load historical DB messages on finish
    onFinish: () => {},
    onError: (err: Error) => {
      console.error(' Chat History: [onError] AI SDK error:', err);
    }
  });
  const isLoading = status === 'submitted' || status === 'streaming';
  const reload = () => {};
  const append = (message: { role: 'user'; content: string } | string) => {
    const text = typeof message === 'string' ? message : message?.content;
    if (text)
      sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] as any },
        {
          body: {
            userId: effectiveUserId ? effectiveUserId.toLowerCase() : undefined,
            walletId: effectiveUserId ? effectiveUserId.toLowerCase() : undefined
          }
        }
      );
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(
      { role: 'user', parts: [{ type: 'text', text: input }] as any },
      {
        body: {
          userId: effectiveUserId ? effectiveUserId.toLowerCase() : undefined,
          walletId: effectiveUserId ? effectiveUserId.toLowerCase() : undefined
        }
      }
    );
    setInput('');
  };

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false);

  // Function to fetch chat history - useCallback to prevent re-creation
  const fetchChatHistory = useCallback(
    async (userId: string): Promise<SdkMessage[]> => {
      setLoadingHistory(true);
      try {
        const { data: dbMessages, error: dbError } = await supabase
          .from('chat_history')
          .select('id, user_id, sender, message, created_at, parent_message_id, step_index')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }); // Fetch sorted by creation time

        if (dbError) throw dbError;

        if (!dbMessages || dbMessages.length === 0) return [];

        const messageMap = new Map<string, SdkMessage>();
        const childrenMap = new Map<string, string[]>();
        const stepIndexMap = new Map<string, number>();
        const addedMessageIds = new Set<string>();
        const result: SdkMessage[] = [];

        // First pass: Convert all messages and map children
        for (const dbMsg of dbMessages) {
          const sdkMsg = convertSingleDbMessageToVercelFormat(dbMsg);
          messageMap.set(sdkMsg.id, sdkMsg);
          // Track step index for assistant messages
          if (dbMsg.sender === 'ai' && typeof (dbMsg as any).step_index === 'number') {
            stepIndexMap.set(sdkMsg.id, (dbMsg as any).step_index);
          }

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
            const childIds = childrenMap.get(currentMsgId) || [];
            const sortedChildIds = [...childIds].sort((a, b) => {
              const ai = stepIndexMap.get(a) ?? 9999;
              const bi = stepIndexMap.get(b) ?? 9999;
              if (ai !== bi) return ai - bi;
              return 0;
            });
            for (const childId of sortedChildIds) {
              const childMsg = messageMap.get(childId);
              if (childMsg && !addedMessageIds.has(childId)) {
                result.push(childMsg);
                addedMessageIds.add(childId);
              }
            }
          } else if (sdkMsg.role === 'assistant' && !dbMsg.parent_message_id) {
            // Add orphan AI message (e.g., initial greeting not linked to user)
            result.push(sdkMsg);
            addedMessageIds.add(currentMsgId); // Add currentMsgId (DB id)
          }
          // AI messages with parents are handled when their parent user message is processed.
        }

        // Include any remaining assistant messages that didn't get attached (safety net)
        for (const dbMsg of dbMessages) {
          const sdkMsg = messageMap.get(dbMsg.id);
          if (!sdkMsg) continue;
          if (sdkMsg.role === 'assistant' && !addedMessageIds.has(dbMsg.id)) {
            result.push(sdkMsg);
            addedMessageIds.add(dbMsg.id);
          }
        }

        return result;
      } catch (err) {
        console.error(' Chat History: Error fetching/processing chat history:', err);
        return []; // Return empty array on error
      } finally {
        setLoadingHistory(false);
      }
    },
    [supabase]
  ); // Keep dependencies

  // Helper function to convert DB message format to Vercel SDK format
  function convertSingleDbMessageToVercelFormat(dbMsg: DbMessage): SdkMessage {
    return {
      id: dbMsg.id,
      role: dbMsg.sender === 'ai' ? 'assistant' : 'user',
      parts: [{ type: 'text', text: dbMsg.message }] as any
    } as SdkMessage;
  }

  // Skip auto-loading historical messages so each refresh starts a new chat session
  useEffect(() => {
    // intentionally no-op
  }, [effectiveUserId, initialHistoryLoaded, fetchChatHistory]);

  // Combine Vercel AI state with custom state
  const value: ChatContextType = {
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
    setMessages,
    loadingHistory,
    isWalletConnected,
    setIsWalletConnected,
    walletAddress,
    setWalletAddress,
    scrollAreaRef
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChatContext = () => {
  // Rename the exported hook
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
