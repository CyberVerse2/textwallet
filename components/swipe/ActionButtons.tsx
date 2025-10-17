'use client';

import { ArrowUp, Check, X } from 'lucide-react';

interface ActionButtonsProps {
  onNo: () => void;
  onSkip: () => void;
  onYes: () => void;
}

export function ActionButtons({ onNo, onSkip, onYes }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      {/* No Button */}
      <button
        onClick={onNo}
        className="group flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
        aria-label="No"
      >
        <X className="h-10 w-10 stroke-[4px] text-red-500 transition-transform group-hover:scale-110" />
      </button>

      {/* Skip Button */}
      <button
        onClick={onSkip}
        className="group flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
        aria-label="Skip"
      >
        <ArrowUp className="h-10 w-10 stroke-[4px] text-black transition-transform group-hover:scale-110" />
      </button>

      {/* Yes Button */}
      <button
        onClick={onYes}
        className="group flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
        aria-label="Yes"
      >
        <Check className="h-10 w-10 stroke-[4px] text-teal-500 transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
