'use client';

import SwipeDeck from '@/components/swipe/SwipeDeck';

export default function Page() {
  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div className="w-full max-w-[420px] h-full">
          <SwipeDeck />
        </div>
      </div>
    </div>
  );
}
