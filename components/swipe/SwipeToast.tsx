'use client';

import { useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToastProps {
  type: 'YES' | 'NO' | 'SKIP' | 'PENDING' | 'ORDER';
  marketTitle: string;
  onUndo?: () => void;
  onClose: () => void;
}

export function SwipeToast({ type, marketTitle, onUndo, onClose }: SwipeToastProps) {
  useEffect(() => {
    if (type === 'PENDING') return; // persistent until explicitly closed/updated
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const colors: Record<'YES' | 'NO' | 'SKIP' | 'PENDING' | 'ORDER', string> = {
    YES: 'bg-green-400',
    NO: 'bg-pink-400',
    SKIP: 'bg-yellow-400',
    PENDING: 'bg-blue-300',
    ORDER: 'bg-green-300'
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 animate-in slide-in-from-bottom-5 sm:bottom-24 sm:w-[calc(100%-2rem)]">
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-4 border-black p-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:gap-3 sm:rounded-2xl sm:border-5 sm:p-4 sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
          colors[type]
        )}
      >
        <div className="flex-shrink-0 rounded-lg border-3 border-black bg-white px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:rounded-xl sm:border-4 sm:px-3 sm:py-2">
          <span className="text-sm font-black text-black sm:text-lg">
            {type === 'PENDING' ? 'PENDING' : type === 'ORDER' ? 'ORDER' : type}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-bold leading-tight text-black sm:text-sm">
            {marketTitle}
          </p>
        </div>
        {onUndo && type !== 'PENDING' && type !== 'ORDER' && (
          <button
            onClick={onUndo}
            className="flex-shrink-0 rounded-lg border-3 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:rounded-xl sm:border-4 sm:p-2.5"
          >
            <RotateCcw className="h-4 w-4 text-black sm:h-5 sm:w-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-lg border-3 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:rounded-xl sm:border-4 sm:p-2.5"
        >
          <X className="h-4 w-4 text-black sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  );
}
