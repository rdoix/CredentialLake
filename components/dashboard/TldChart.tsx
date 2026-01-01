'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TldStat } from '@/types/dashboard';

interface TldChartProps {
  data: TldStat[];
  onTldClick?: (tld: string) => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function TldChart({ data, onTldClick }: TldChartProps) {
  const handlePieClick = (data: any) => {
    if (onTldClick && data?.tld) {
      onTldClick(data.tld);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Top TLDs</h3>
          <p className="text-sm text-muted">Distribution by top-level domain</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
          {data.length} TLDs
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ tld, percentage }) => `${tld} ${percentage}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="count"
            onClick={handlePieClick}
            cursor={onTldClick ? 'pointer' : 'default'}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#131824',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#e2e8f0',
            }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [value.toLocaleString(), 'Count']}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {data.map((item, index) => (
          <div
            key={item.tld}
            className={`flex items-center gap-2 ${onTldClick ? 'cursor-pointer hover:bg-background/50 rounded px-2 py-1 transition-colors' : ''}`}
            onClick={() => onTldClick && onTldClick(item.tld)}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-sm text-muted">{item.tld}</span>
            <span className="text-sm font-medium text-foreground ml-auto">
              {item.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
