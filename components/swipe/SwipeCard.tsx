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
      <div className="relative h-[90%] w-full rounded-3xl border-[6px] border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-6 flex items-center justify-between gap-3 w-full">
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-2xl border-4 border-black px-6 py-4',
              card.logoColor,
              'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            )}
          >
            {card.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.logoUrl}
                alt=""
                className="h-12 w-12 md:h-16 md:w-16 object-cover rounded-xl border-2 border-black"
              />
            ) : (
              <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
                {card.logo}
              </span>
            )}
          </div>

          {/* Volume Badge */}
          {card.volume && (
            <div className="rounded-xl border-4 border-black bg-purple-400 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase tracking-wide text-black/70">Volume</div>
              <div className="text-2xl font-black text-black">{card.volume}</div>
            </div>
          )}
        </div>

        <h2 className="mb-4 text-balance text-2xl font-black leading-tight text-black">
          {card.question}
        </h2>

        <p className="mb-4 text-pretty text-sm leading-relaxed text-gray-700 line-clamp-2 md:line-clamp-3">
          {summarize(card.description)}
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border-4 border-black bg-green-400 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black">
              Yes potential
            </div>
            <div className="mb-2 text-3xl font-black text-black">{card.yesAmount}</div>
            <div className="text-xs font-semibold text-black/70">Price: {card.yesPrice}</div>
          </div>

          <div className="rounded-xl border-4 border-black bg-pink-400 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-black">
              No potential
            </div>
            <div className="mb-2 text-3xl font-black text-black">{card.noAmount}</div>
            <div className="text-xs font-semibold text-black/70">Price: {card.noPrice}</div>
          </div>
        </div>

        <div className="mt-2 inline-block rounded-lg border-3 border-black bg-blue-400 px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-sm font-black text-black">Ends: {card.endDate}</span>
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
