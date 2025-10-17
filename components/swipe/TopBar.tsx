'use client';

import React from 'react';
import { useConnections } from 'wagmi';

export default function TopBar() {
  const connections = useConnections();
  const connected = connections.length > 0;
  return (
    <div
      className="px-4 py-3 border-b-2 border-black bg-white"
      style={{ boxShadow: '0 2px 0 0 #000' }}
    >
      <div className="flex items-center justify-between">
        <div className="font-bold">Swipe</div>
        <div
          className="text-sm px-2 py-1 rounded-md border-2 border-black"
          style={{ boxShadow: '2px 2px 0 0 #000' }}
        >
          {connected ? 'Connected' : 'Not Connected'}
        </div>
      </div>
    </div>
  );
}
