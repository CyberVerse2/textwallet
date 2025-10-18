'use client';

import { ArrowUp, Check, X } from 'lucide-react';

interface ActionButtonsProps {
  onNo: () => void;
  onSkip: () => void;
  onYes: () => void;
}

export function ActionButtons({ onNo, onSkip, onYes }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      {/* No Button */}
      <button
        onClick={onNo}
        className="group flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-black bg-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none sm:h-20 sm:w-20 sm:border-[5px] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[3px] sm:hover:translate-y-[3px] sm:active:translate-x-[6px] sm:active:translate-y-[6px]"
        aria-label="No"
      >
        <X className="h-8 w-8 stroke-[3px] text-red-500 transition-transform group-hover:scale-110 sm:h-10 sm:w-10 sm:stroke-[4px]" />
      </button>

      {/* Skip Button */}
      <button
        onClick={onSkip}
        className="group flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-black bg-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none sm:h-20 sm:w-20 sm:border-[5px] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[3px] sm:hover:translate-y-[3px] sm:active:translate-x-[6px] sm:active:translate-y-[6px]"
        aria-label="Skip"
      >
        <ArrowUp className="h-8 w-8 stroke-[3px] text-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10 sm:stroke-[4px]" />
      </button>

      {/* Yes Button */}
      <button
        onClick={onYes}
        className="group flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-black bg-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none sm:h-20 sm:w-20 sm:border-[5px] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:hover:translate-x-[3px] sm:hover:translate-y-[3px] sm:active:translate-x-[6px] sm:active:translate-y-[6px]"
        aria-label="Yes"
      >
        <Check className="h-8 w-8 stroke-[3px] text-teal-500 transition-transform group-hover:scale-110 sm:h-10 sm:w-10 sm:stroke-[4px]" />
      </button>
    </div>
  );
}
