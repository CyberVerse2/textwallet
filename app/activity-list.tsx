'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, Wallet, BarChart2, Clock } from 'lucide-react';

interface Activity {
  type: 'trade' | 'permission' | 'other';
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed' | 'posted';
}

interface ActivityListProps {
  walletAddress?: string | null;
  refreshTrigger?: number;
}

export default function ActivityList({ walletAddress, refreshTrigger }: ActivityListProps) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        const url = walletAddress ? `/api/activity?userId=${walletAddress}` : '/api/activity';
        const res = await fetch(url);
        const json = await res.json();
        if (!isMounted) return;
        const list: Activity[] = Array.isArray(json?.activities) ? json.activities : [];
        setActivities(list);
      } catch {
        if (!isMounted) return;
        setActivities([]);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [walletAddress, refreshTrigger]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'trade':
        return <ArrowRightLeft className="h-3 w-3" />;
      case 'permission':
        return <Wallet className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-blue';
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
          className="p-3 rounded-xl border-2 border-black hover:bg-yellow/10 active:translate-y-1 active:shadow-none cursor-pointer transition-all duration-100"
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
                <div className="text-sm font-bold">{activity.description}</div>
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
