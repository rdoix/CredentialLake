'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TimelineData } from '@/types/dashboard';
import { format, parseISO } from 'date-fns';

interface TimelineChartProps {
  data: TimelineData[];
}

export default function TimelineChart({ data }: TimelineChartProps) {
  // Sanitize incoming series to avoid NaN/Infinity triggering DecimalError in recharts-scale
  const safeData = (Array.isArray(data) ? data : []).map((item) => {
    const credsRaw = (item as any)?.credentials;
    const parsedRaw = (item as any)?.parsed;
    const failedRaw = (item as any)?.failed;
    const creds = Number.isFinite(Number(credsRaw)) ? Number(credsRaw) : 0;
    const parsed = Number.isFinite(Number(parsedRaw)) ? Number(parsedRaw) : 0;
    const failed = Number.isFinite(Number(failedRaw)) ? Number(failedRaw) : 0;
    return {
      ...item,
      credentials: creds < 0 ? 0 : creds,
      parsed: parsed < 0 ? 0 : parsed,
      failed: failed < 0 ? 0 : failed,
    };
  });

  const formattedData = safeData.map((item) => ({
    ...item,
    dateFormatted: format(parseISO(item.date), 'MMM dd'),
  }));

  const totalToday = safeData.length ? safeData[safeData.length - 1] : undefined;
  const parseRate =
    totalToday && totalToday.credentials > 0
      ? ((totalToday.parsed / totalToday.credentials) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Daily Ingestion Timeline</h3>
          <p className="text-sm text-muted">Credential collection over the past week</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-sm text-muted">Today's Total</p>
            <p className="text-xl font-bold text-primary">{totalToday?.credentials.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Parse Rate</p>
            <p className="text-xl font-bold text-accent">{parseRate}%</p>
          </div>
        </div>
      </div>

      {formattedData.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-muted">No timeline data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorCredentials" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorParsed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="dateFormatted" stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#131824',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: number) => value.toLocaleString()}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Area
              type="monotone"
              dataKey="credentials"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCredentials)"
              name="Total Credentials"
            />
            <Area
              type="monotone"
              dataKey="parsed"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorParsed)"
              name="Parsed"
            />
            <Area
              type="monotone"
              dataKey="failed"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFailed)"
              name="Failed"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
