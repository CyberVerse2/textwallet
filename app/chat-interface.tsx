"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Check, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  actions?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "destructive" | "outline" | "white"
  }[]
  loading?: boolean
}

export default function ChatInterface() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-message",
      role: "assistant",
      content:
        "Hello! I'm your Text Wallet assistant. You can ask me to check your balance, swap tokens, or get information about liquidity pools. How can I help you today?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsProcessing(true)

    // Simulate typing indicator
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString(),
      loading: true,
    }
    setMessages((prev) => [...prev, loadingMessage])

    // Process the message after a delay to simulate AI thinking
    setTimeout(() => {
      setMessages((prev) => prev.filter((msg) => !msg.loading))
      processUserMessage(input)
      setIsProcessing(false)
    }, 1000)
  }

  const processUserMessage = (message: string) => {
    const lowerMessage = message.toLowerCase()
    let response: Message

    // Check balance intent
    if (lowerMessage.includes("balance") || lowerMessage.includes("my tokens") || lowerMessage.includes("holdings")) {
      response = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "Here's your current balance across all supported chains:\n\n• 5.0 BNB ($1,250.00)\n• 1.2 ETH ($2,400.00)\n• 500.0 USDT ($500.00)\n\nTotal portfolio value: $4,150.00",
        timestamp: new Date().toLocaleTimeString(),
      }
    }
    // Swap tokens intent
    else if (lowerMessage.includes("swap") || lowerMessage.includes("exchange") || lowerMessage.includes("convert")) {
      // Extract tokens from message (simplified)
      const fromToken = lowerMessage.includes("bnb") ? "BNB" : lowerMessage.includes("eth") ? "ETH" : "USDT"
      const toToken = lowerMessage.includes("base") ? "BASE" : lowerMessage.includes("usdt") ? "USDT" : "ETH"

      response = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `I can help you swap ${fromToken} to ${toToken}. Based on current rates:\n\n• 1 ${fromToken} ≈ 100 ${toToken}\n• Estimated gas fee: 0.001 BNB ($0.25)\n\nWould you like to proceed with this swap?`,
        timestamp: new Date().toLocaleTimeString(),
        actions: [
          {
            label: "Confirm Swap",
            onClick: () => handleSwapConfirm(fromToken, toToken),
            variant: "white",
          },
          {
            label: "Cancel",
            onClick: () => handleSwapCancel(),
            variant: "outline",
          },
        ],
      }
    }
    // Liquidity pools intent
    else if (
      lowerMessage.includes("liquidity") ||
      lowerMessage.includes("pools") ||
      lowerMessage.includes("best liquids")
    ) {
      response = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "Here are the top liquidity pools based on APY:\n\n1. BNB-BASE: 12.5% APY ($10.5M TVL)\n2. ETH-USDT: 8.2% APY ($25.2M TVL)\n3. BNB-CAKE: 15.3% APY ($5.1M TVL)\n\nWould you like more details on any of these pools?",
        timestamp: new Date().toLocaleTimeString(),
      }
    }
    // Default response for unrecognized intents
    else {
      response = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          'I\'m not sure I understand. You can ask me to:\n\n• Check your balance\n• Swap tokens (e.g., "Swap 1 BNB to BASE")\n• Get information about liquidity pools\n\nHow can I assist you?',
        timestamp: new Date().toLocaleTimeString(),
      }
    }

    setMessages((prev) => [...prev, response])
  }

  const handleSwapConfirm = (fromToken: string, toToken: string) => {
    // Simulate transaction processing
    const processingMessage: Message = {
      id: `processing-${Date.now()}`,
      role: "assistant",
      content: `Processing your swap from ${fromToken} to ${toToken}...`,
      timestamp: new Date().toLocaleTimeString(),
      loading: true,
    }

    setMessages((prev) => [...prev, processingMessage])

    // Simulate transaction completion after delay
    setTimeout(() => {
      setMessages((prev) => prev.filter((msg) => !msg.loading))

      const completionMessage: Message = {
        id: `completion-${Date.now()}`,
        role: "assistant",
        content: `✅ Swap completed successfully!\n\nYou've swapped 1 ${fromToken} for 100 ${toToken}.\nTransaction hash: 0x7a2d8c3e4b5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b\n\nYour updated balances:\n• ${fromToken}: ${fromToken === "BNB" ? "4.0" : fromToken === "ETH" ? "0.2" : "400.0"}\n• ${toToken}: 100.0`,
        timestamp: new Date().toLocaleTimeString(),
      }

      setMessages((prev) => [...prev, completionMessage])
    }, 2000)
  }

  const handleSwapCancel = () => {
    const cancelMessage: Message = {
      id: `cancel-${Date.now()}`,
      role: "assistant",
      content: "Swap cancelled. Is there anything else you'd like to do?",
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, cancelMessage])
  }

  const copyToClipboard = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedMessageId(messageId)
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <ScrollArea className="flex-1 p-6 pb-24" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex max-w-[85%]", message.role === "user" ? "ml-auto justify-end" : "justify-start")}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{message.role === "assistant" ? "Text Wallet" : "You"}</span>
                  <span className="text-sm text-muted-foreground">{message.timestamp}</span>
                </div>
                <div className="flex items-start gap-3">
                  {message.role === "assistant" && (
                    <div
                      className="h-10 w-10 rounded-full bg-yellow flex items-center justify-center flex-shrink-0 text-xl font-bold"
                      style={{ boxShadow: "3px 3px 0px 0px #000000" }}
                    >
                      *
                    </div>
                  )}
                  <div
                    className={cn(
                      "p-4 rounded-xl border-2",
                      message.role === "assistant" ? "bg-white border-black" : "bg-yellow border-black text-black",
                    )}
                    style={{ boxShadow: "5px 5px 0px 0px #000000" }}
                  >
                    {message.loading ? (
                      <div className="flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <p>Processing...</p>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
                {message.actions && (
                  <div className="flex flex-wrap gap-2 mt-3 ml-[52px]">
                    {message.actions.map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        onClick={action.onClick}
                        className={cn(
                          "rounded-xl font-medium active:translate-y-1 active:shadow-none transition-all duration-100",
                          action.variant === "outline" && "border-2 border-black hover:bg-yellow/20",
                          action.variant === "white" && "bg-white text-black border-2 border-black hover:bg-gray-50",
                        )}
                        style={{ boxShadow: "4px 4px 0px 0px #000000" }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
                {message.role === "assistant" && !message.loading && (
                  <div className="flex items-center gap-2 ml-[52px]">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100"
                      onClick={() => copyToClipboard(message.id, message.content)}
                      style={{ boxShadow: "2px 2px 0px 0px #000000" }}
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-6 border-t absolute bottom-0 left-0 right-0 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <Textarea
            placeholder="Ask about your balance, swap tokens, or check liquidity pools..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[50px] max-h-32 flex-1 rounded-xl border-2 border-black focus-visible:ring-yellow"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
              }
            }}
            disabled={isProcessing}
            style={{ boxShadow: "5px 5px 0px 0px #000000" }}
          />
          <Button
            type="submit"
            className="px-8 rounded-xl border-2 border-black bg-yellow text-black hover:bg-yellow-dark hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all duration-100 flex items-center gap-2"
            disabled={isProcessing || !input.trim()}
            style={{ boxShadow: "5px 5px 0px 0px #000000", transform: "rotate(1deg)" }}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Send
                <ArrowRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

