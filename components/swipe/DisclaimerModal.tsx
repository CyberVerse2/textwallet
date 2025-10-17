'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DisclaimerModalProps {
  onClose: () => void;
}

export function DisclaimerModal({ onClose }: DisclaimerModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setIsVisible(true);
  }, []);

  const handleAccept = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${
          isVisible ? 'opacity-60' : 'opacity-0'
        }`}
        onClick={handleAccept}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`relative w-full max-w-md transform transition-all duration-300 ${
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          <div className="relative rounded-2xl border-5 border-black bg-gradient-to-br from-orange-400 to-red-500 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {/* Close button */}
            <button
              onClick={handleAccept}
              className="absolute right-4 top-4 rounded-full border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Warning icon */}
            <div className="mb-4 flex justify-center">
              <div className="rounded-full border-5 border-black bg-yellow-300 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <AlertTriangle className="h-12 w-12 text-black" />
              </div>
            </div>

            {/* Title */}
            <h2 className="mb-4 text-center text-3xl font-black text-white">Important Notice</h2>

            {/* Content */}
            <div className="mb-6 space-y-3 rounded-xl border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-base font-bold leading-relaxed text-black">
                We use <span className="text-red-600">Fill-Or-Kill (FOK)</span> orders for all
                swipes.
              </p>
              <p className="text-sm leading-relaxed text-gray-700">
                This means your swipe may fail if there isn't enough liquidity to fill your order
                immediately.
              </p>
              <p className="text-sm font-bold leading-relaxed text-black">
                💡 Trade markets with high volume for the best experience!
              </p>
            </div>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              className="w-full rounded-xl border-5 border-black bg-gradient-to-r from-green-400 to-emerald-500 px-6 py-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
