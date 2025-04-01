'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Sparkles, Wallet, BarChart2, ArrowRightLeft } from 'lucide-react';

interface LandingPageProps {
  onStartChat: () => void;
}

export default function LandingPage({ onStartChat }: LandingPageProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onStartChat();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full flex flex-col items-center text-center">
          {/* Logo and Welcome */}
          <div
            className="h-20 w-20 rounded-full bg-yellow flex items-center justify-center text-4xl font-bold mb-6"
            style={{ boxShadow: '5px 5px 0px 0px #000000' }}
          >
            *
          </div>
          <h1 className="text-4xl font-bold mb-3">Welcome to Text Wallet</h1>
          <p className="text-xl mb-8">Your conversational DeFi assistant</p>

          {/* Example Prompts */}
          <div className="mb-8 w-full">
            {/* <p className="mt-3 text-sm font-bold mb-3 text-center">Try asking:</p> */}
            <div className=" flex flex-wrap gap-2 justify-center">
              <ExamplePrompt
                text="What is my balance?"
                onClick={() => {
                  setInput('What is my balance?');
                }}
              />
              <ExamplePrompt
                text="Swap 1 BNB to BASE"
                onClick={() => {
                  setInput('Swap 1 BNB to BASE');
                }}
              />
              <ExamplePrompt
                text="Show me the best liquidity pools"
                onClick={() => {
                  setInput('Show me the best liquidity pools');
                }}
              />
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <Textarea
                placeholder="Ask about your balance, swap tokens, or check liquidity pools..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[60px] max-h-32 w-full rounded-xl border-2 border-black focus-visible:ring-yellow text-base px-4 py-4 pr-[120px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                style={{ boxShadow: '5px 5px 0px 0px #000000' }}
              />
              <Button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 px-4 rounded-xl border-2 border-black bg-yellow text-black hover:bg-yellow-dark hover:-translate-y-[calc(50%+2px)] active:translate-y-[calc(50%+2px)] active:shadow-none transition-all duration-100 flex items-center gap-1 font-bold"
                disabled={!input.trim()}
                style={{ boxShadow: '3px 3px 0px 0px #000000' }}
              >
                <span>Start</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-sm text-muted-foreground">
        <p>
          Built by <a href="https://x.com/TheCyberverse1">The Cyberverse</a>
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="p-4 rounded-xl border-2 border-black bg-white flex flex-col items-center text-center"
      style={{ boxShadow: '5px 5px 0px 0px #000000' }}
    >
      <div
        className="h-12 w-12 rounded-full bg-yellow flex items-center justify-center mb-3"
        style={{ boxShadow: '3px 3px 0px 0px #000000' }}
      >
        {icon}
      </div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ExamplePrompt({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      className="px-3 py-2 rounded-lg border-2 border-black bg-white hover:bg-yellow/10 active:translate-y-1 active:shadow-none transition-all duration-100 text-sm flex items-center font-medium"
      onClick={onClick}
      style={{ boxShadow: '3px 3px 0px 0px #000000' }}
    >
      <Sparkles className="h-3 w-3 mr-2" />
      {text}
    </button>
  );
}
