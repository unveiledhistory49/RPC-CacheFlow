'use client';

import { Card, Title, Text, Metric, Grid, Badge } from '@tremor/react';
import { Activity, Server, Clock, Database, AlertCircle } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: { 'x-admin-secret': 'admin-secret' } // Hardcoded for demo
}).then(res => res.json());

export default function Dashboard() {
  const { data: stats, error: statsError } = useSWR('/api/admin/stats', fetcher, { refreshInterval: 5000 });
  const { data: usage, error: usageError } = useSWR('/api/admin/usage', fetcher, { refreshInterval: 5000 });

  if (statsError || usageError) return <Text>Failed to load data</Text>;
  if (!stats) return <Text>Loading...</Text>;

  return (
    <main className="p-10 min-h-screen bg-slate-50">
      <Title className="text-3xl font-bold mb-6">RPC CacheFlow Admin</Title>

      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="blue">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <Text>Uptime</Text>
          </div>
          <Metric>{Math.floor(stats.system.uptime / 60)}m</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-emerald-500" />
            <Text>Upstreams</Text>
          </div>
          <Metric>{stats.upstreams.length}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-amber-500" />
            <Text>Memory Usage</Text>
          </div>
          <Metric>{Math.floor(stats.system.memory.rss / 1024 / 1024)} MB</Metric>
        </Card>
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Upstream Health Status</Title>
          <div className="mt-4 space-y-4">
            {stats.upstreams.map((u: any) => (
              <div key={u.url} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${u.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <Text className="font-medium text-gray-900">{u.url}</Text>
                    <Text className="text-xs">Lat: {u.latency?.toFixed(0)}ms | Avg: {u.averageLatency?.toFixed(0)}ms</Text>
                  </div>
                </div>
                {!u.healthy && <Badge color="red" icon={AlertCircle}>DOWN</Badge>}
                {u.healthy && <Badge color="green" icon={Activity}>Healthy</Badge>}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Title>Top Consumers (Requests)</Title>
          <div className="mt-4 space-y-2">
            {usage?.map((item: any, idx: number) => (
               <div key={item.key} className="flex items-center justify-between p-2 border-b last:border-0">
                 <div className="flex items-center space-x-3">
                   <Badge color="slate">{idx + 1}</Badge>
                   <Text className="font-mono text-sm">{item.key.replace('ratelimit:', '')}</Text>
                 </div>
                 <Text className="font-bold">{item.count}</Text>
               </div>
            ))}
            {(!usage || usage.length === 0) && <Text className="text-gray-400">No traffic recorded yet.</Text>}
          </div>
        </Card>
      </div>
    </main>
  );
}