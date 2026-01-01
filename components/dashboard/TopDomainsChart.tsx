'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DomainStat } from '@/types/dashboard';

interface TopDomainsChartProps {
  data: DomainStat[];
  onDomainClick?: (domain: string) => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6'];

export default function TopDomainsChart({ data, onDomainClick }: TopDomainsChartProps) {
  const handleBarClick = (data: any) => {
    if (onDomainClick && data?.domain) {
      onDomainClick(data.domain);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Top Domains</h3>
          <p className="text-sm text-muted">Most affected domains by credential leaks</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          {data.length} domains
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] text-muted">
          <p>No domain data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <YAxis
              type="category"
              dataKey="domain"
              width={150}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#131824',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value: number) => [value.toLocaleString(), 'Credentials']}
              />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              onClick={handleBarClick}
              cursor={onDomainClick ? 'pointer' : 'default'}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
