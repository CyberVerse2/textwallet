'use client';

import React from 'react';
import SwipeDeck from '@/components/swipe/SwipeDeck';
import TopBar from '@/components/swipe/TopBar';

export default function SwipePage() {
  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <TopBar />
      <div className="flex-1 min-h-0">
        <SwipeDeck />
      </div>
    </div>
  );
}
