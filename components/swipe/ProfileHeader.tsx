'use client';

import React from 'react';
import { useAccount, useConnections } from 'wagmi';

export default function ProfileHeader() {
  const { address } = useAccount();
  const connections = useConnections();
  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—';

  return (
    <div className="px-4 pt-2 pb-3">
      <div
        className="rounded-2xl border-2 border-black p-4 bg-white"
        style={{ boxShadow: '6px 6px 0 0 #000' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 border-black bg-blue" />
          <div className="flex-1">
            <div className="font-bold text-lg">{short}</div>
            <div className="text-xs text-muted-foreground">
              {connections.length > 0 ? 'Connected' : 'Not connected'}
            </div>
          </div>
          <div
            className="text-xs px-2 py-1 rounded-md border-2 border-black"
            style={{ boxShadow: '2px 2px 0 0 #000' }}
          >
            $0.00
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="rounded-md border border-black/20 py-1">
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
