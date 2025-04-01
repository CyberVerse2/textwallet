'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, Wallet, BarChart2, Clock } from 'lucide-react';

interface Activity {
  type: 'swap' | 'balance' | 'liquidity' | 'other';
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function ActivityList() {
  const [activities] = useState<Activity[]>([
    {
      type: 'swap',
      description: 'Swapped 1 BNB for 100 BASE',
      timestamp: '10:45 AM',
      status: 'completed'
    },
    {
      type: 'balance',
      description: 'Checked wallet balance',
      timestamp: '10:30 AM',
      status: 'completed'
    },
    {
      type: 'liquidity',
      description: 'Viewed top liquidity pools',
      timestamp: 'Yesterday',
      status: 'completed'
    },
    {
      type: 'swap',
      description: 'Swapped 0.5 ETH for 800 USDT',
      timestamp: 'Yesterday',
      status: 'completed'
    },
    {
      type: 'other',
      description: 'Connected wallet',
      timestamp: 'Yesterday',
      status: 'completed'
    }
  ]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'swap':
        return <ArrowRightLeft className="h-4 w-4" />;
      case 'balance':
        return <Wallet className="h-4 w-4" />;
      case 'liquidity':
        return <BarChart2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div
          key={index}
          className="p-3 rounded-xl border-2 border-black hover:bg-yellow/10 transition-colors active:translate-y-1 active:shadow-none cursor-pointer transition-all duration-100"
          style={{ boxShadow: '4px 4px 0px 0px #000000' }}
        >
          <div className="flex items-start">
            <div
              className="mr-3 h-8 w-8 rounded-full bg-yellow flex items-center justify-center"
              style={{ boxShadow: '2px 2px 0px 0px #000000' }}
            >
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-bold">{activity.description}</div>
                <div className={cn('h-2 w-2 rounded-full', getStatusColor(activity.status))}></div>
              </div>
              <div className="text-sm text-muted-foreground">{activity.timestamp}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
