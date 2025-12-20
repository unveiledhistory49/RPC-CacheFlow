'use client';

import { Card, Title, Text, Metric, Grid, Badge, DonutChart, BarList, Flex, Subtitle } from '@tremor/react';
import { Activity, Server, Clock, Database, AlertCircle, Zap, RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url, {
  headers: { 'x-admin-secret': 'admin-secret' } // Hardcoded for demo
}).then(res => res.json());

const valueFormatter = (number: number) => `$ ${new Intl.NumberFormat('us').format(number).toString()}`;

export default function Dashboard() {
  const { data: stats, error: statsError } = useSWR('/api/admin/stats', fetcher, { refreshInterval: 2000 });
  const { data: usage, error: usageError } = useSWR('/api/admin/usage', fetcher, { refreshInterval: 5000 });
  const [copied, setCopied] = useState<string | null>(null);

  if (statsError || usageError) return <div className="p-10 text-red-500">Failed to load data. Is the backend running?</div>;
  if (!stats) return <div className="p-10 text-slate-500 animate-pulse">Loading Dashboard...</div>;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const cacheData = [
    { name: 'Cache Hits', value: stats.cache?.hits || 0, color: 'emerald' },
    { name: 'Cache Misses', value: stats.cache?.misses || 0, color: 'rose' },
  ];

  const upstreamLatencyData = stats.upstreams.map((u: any) => ({
    name: u.url.replace(/^https?:\/\//, ''),
    value: u.latency || 0,
    href: u.url
  }));

  return (
    <main className="p-6 md:p-10 min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Title className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
            <Zap className="w-8 h-8 text-indigo-600 fill-indigo-100" />
            RPC CacheFlow
          </Title>
          <Text className="text-slate-500 mt-1">Enterprise RPC Gateway & Load Balancer</Text>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <Text className="text-xs font-medium text-slate-600">Live</Text>
        </div>
      </div>

      {/* KPI Grid */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="indigo">
          <Flex justifyContent="start" className="space-x-4">
            <Activity className="w-8 h-8 text-indigo-500 p-1.5 bg-indigo-50 rounded-lg" />
            <div>
              <Text>System Uptime</Text>
              <Metric>{Math.floor(stats.system.uptime / 60)}m</Metric>
            </div>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Flex justifyContent="start" className="space-x-4">
            <Server className="w-8 h-8 text-emerald-500 p-1.5 bg-emerald-50 rounded-lg" />
            <div>
              <Text>Active Upstreams</Text>
              <Metric>{stats.upstreams.filter((u:any) => u.healthy).length} <span className="text-sm text-slate-400 font-normal">/ {stats.upstreams.length}</span></Metric>
            </div>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="violet">
          <Flex justifyContent="start" className="space-x-4">
            <RefreshCw className="w-8 h-8 text-violet-500 p-1.5 bg-violet-50 rounded-lg" />
            <div>
              <Text>Cache Hit Rate</Text>
              <Metric>{(Number(stats.cache?.ratio || 0) * 100).toFixed(0)}%</Metric>
            </div>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Flex justifyContent="start" className="space-x-4">
            <Database className="w-8 h-8 text-amber-500 p-1.5 bg-amber-50 rounded-lg" />
            <div>
              <Text>Memory Usage</Text>
              <Metric>{Math.floor(stats.system.memory.rss / 1024 / 1024)} MB</Metric>
            </div>
          </Flex>
        </Card>
      </Grid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Cache Stats */}
        <Card className="lg:col-span-1">
          <Title>Cache Efficiency</Title>
          <Subtitle>Hits vs Misses</Subtitle>
          <div className="mt-6">
             <DonutChart
              className="mt-6"
              data={cacheData}
              category="value"
              index="name"
              colors={["emerald", "rose"]}
              showAnimation={true}
              variant="pie"
            />
            <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-emerald-50 rounded-md">
                    <Text className="text-emerald-700 font-bold">{stats.cache?.hits}</Text>
                    <Text className="text-xs text-emerald-600">Hits</Text>
                </div>
                <div className="text-center p-2 bg-rose-50 rounded-md">
                    <Text className="text-rose-700 font-bold">{stats.cache?.misses}</Text>
                    <Text className="text-xs text-rose-600">Misses</Text>
                </div>
            </div>
          </div>
        </Card>

        {/* Column 2: Upstream Status */}
        <Card className="lg:col-span-2">
          <Title>Upstream Performance</Title>
          <Subtitle>Real-time latency monitoring</Subtitle>
          <div className="mt-6 space-y-4">
            {stats.upstreams.map((u: any) => (
              <div key={u.url} className="group relative flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 hover:shadow-sm transition-all">
                <div className="flex items-center space-x-4">
                  <div className={`relative w-3 h-3 rounded-full ${u.healthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500'}`}>
                    {u.healthy && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20" />}
                  </div>
                  <div>
                    <Text className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => copyToClipboard(u.url)}>
                        {u.url.replace(/^https?:\/\//, '')}
                    </Text>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${u.latency < 200 ? 'bg-emerald-400' : u.latency < 500 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                                style={{ width: `${Math.min((u.latency / 1000) * 100, 100)}%` }} 
                            />
                        </div>
                        <Text className="text-xs text-slate-400">{u.latency?.toFixed(0)}ms</Text>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                   {copied === u.url ? 
                        <Badge size="xs" color="indigo">Copied!</Badge> : 
                        <Badge size="xs" color={u.healthy ? 'emerald' : 'rose'}>{u.healthy ? 'HEALTHY' : 'DOWN'}</Badge>
                   }
                </div>
              </div>
            ))}
          </div>
        </Card>
        
         {/* Column 3: Top Consumers (Full Width on Mobile) */}
         <Card className="lg:col-span-3">
            <Title>Top Consumers</Title>
            <Subtitle>API Key usage distribution</Subtitle>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usage?.map((item: any, idx: number) => (
                <div key={item.key} className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-500 font-bold shadow-sm mr-3">
                        {idx + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <Text className="truncate font-mono text-sm text-slate-700">{item.key.replace('ratelimit:', '')}</Text>
                        <div className="w-full bg-slate-200 h-1 mt-1 rounded-full overflow-hidden">
                             <div className="bg-indigo-500 h-full" style={{ width: '60%' }}></div>
                        </div>
                    </div>
                    <Text className="font-bold text-slate-900 ml-3">{item.count}</Text>
                </div>
                ))}
                 {(!usage || usage.length === 0) && <Text className="col-span-3 text-center py-8 text-gray-400 italic">No traffic recorded yet. Send some requests!</Text>}
            </div>
         </Card>
      </div>
    </main>
  );
}