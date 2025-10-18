'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Card {
  id: number;
  logo: string;
  logoUrl?: string;
  logoColor: string;
  question: string;
  description: string;
  yesAmount: string;
  yesPrice: string;
  noAmount: string;
  noPrice: string;
  endDate: string;
  volume?: string;
}

interface SwipeCardProps {
  card: Card;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
}

export function SwipeCard({ card, onSwipe }: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartPos({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newX = clientX - startPos.x;
    const newY = clientY - startPos.y;
    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => {
    setIsDragging(false);
    const threshold = 100;

    if (Math.abs(position.x) > threshold) {
      onSwipe(position.x < 0 ? 'left' : 'right');
    } else if (position.y < -threshold) {
      onSwipe('up');
    } else {
      setPosition({ x: 0, y: 0 });
    }
  };

  const rotation = position.x / 20;
  const opacity = 1 - Math.abs(position.x) / 300;

  const summarize = (text: string, max = 120) => {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const slice = clean.slice(0, max);
    const lastSpace = slice.lastIndexOf(' ');
    return `${slice.slice(0, lastSpace > 60 ? lastSpace : max)}…`;
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'absolute inset-0 cursor-grab touch-none select-none transition-transform',
        isDragging && 'cursor-grabbing'
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
        opacity: 1,
        transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
      }}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
    >
      <div className="relative h-[90%] w-full rounded-2xl border-[4px] border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:rounded-3xl sm:border-[6px] sm:p-6 sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2 sm:gap-3 w-full">
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-xl border-3 border-black px-4 py-3 sm:rounded-2xl sm:border-4 sm:px-6 sm:py-4',
              card.logoColor,
              'shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            )}
          >
            {card.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.logoUrl}
                alt=""
                className="h-10 w-10 object-cover rounded-lg border-2 border-black sm:h-12 sm:w-12 sm:rounded-xl md:h-16 md:w-16"
              />
            ) : (
              <span className="text-4xl font-black text-white drop-shadow-lg sm:text-5xl md:text-7xl">
                {card.logo}
              </span>
            )}
          </div>

          {/* Volume Badge */}
          {card.volume && (
            <div className="rounded-lg border-3 border-black bg-purple-400 px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-4 sm:px-4 sm:py-3 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase tracking-wide text-black/70">Volume</div>
              <div className="text-lg font-black text-black sm:text-2xl">{card.volume}</div>
            </div>
          )}
        </div>

        <h2 className="mb-3 text-balance text-xl font-black leading-tight text-black sm:mb-4 sm:text-2xl">
          {card.question}
        </h2>

        <p className="mb-3 text-pretty text-xs leading-relaxed text-gray-700 line-clamp-2 sm:mb-4 sm:text-sm md:line-clamp-3">
          {summarize(card.description)}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4">
          <div className="rounded-lg border-3 border-black bg-green-400 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-4 sm:p-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[2px] sm:hover:translate-y-[2px]">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black">
              Yes potential
            </div>
            <div className="mb-2 text-2xl font-black text-black sm:text-3xl">{card.yesAmount}</div>
            <div className="text-xs font-semibold text-black/70">Price: {card.yesPrice}</div>
          </div>

          <div className="rounded-lg border-3 border-black bg-pink-400 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-4 sm:p-4 sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[2px] sm:hover:translate-y-[2px]">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black">
              No potential
            </div>
            <div className="mb-2 text-2xl font-black text-black sm:text-3xl">{card.noAmount}</div>
            <div className="text-xs font-semibold text-black/70">Price: {card.noPrice}</div>
          </div>
        </div>

        <div className="mt-2 inline-block rounded-md border-2 border-black bg-blue-400 px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:rounded-lg sm:border-3 sm:px-4 sm:py-2">
          <span className="text-xs font-black text-black sm:text-sm">Ends: {card.endDate}</span>
        </div>

        {isDragging && (
          <>
            {position.x < -50 && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 rotate-[-20deg] rounded-xl border-4 border-black bg-pink-400 px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-4xl font-black text-black">NO</span>
              </div>
            )}
            {position.x > 50 && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 rotate-[20deg] rounded-xl border-4 border-black bg-green-400 px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-4xl font-black text-black">YES</span>
              </div>
            )}
            {position.y < -50 && (
              <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-xl border-4 border-black bg-yellow-400 px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-4xl font-black text-black">SKIP</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
