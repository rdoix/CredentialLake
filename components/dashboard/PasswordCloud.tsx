'use client';

import { useEffect, useRef, useState } from 'react';
import { PasswordStat } from '@/types/dashboard';

interface PasswordCloudProps {
  data: PasswordStat[];
}

export default function PasswordCloud({ data }: PasswordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Safely compute ranges; handle empty data and uniform values to avoid NaN font sizes
  const values = data
    .map((d) => Number(d.value))
    .filter((v) => Number.isFinite(v) && v > 0);
  const maxValue = values.length ? Math.max(...values) : 0;
  const minValue = values.length ? Math.min(...values) : 0;
  
  const getSize = (value: number) => {
    const minSize = 12;
    const maxSize = 48;
    // If no variability or empty, use a mid-size to avoid divide-by-zero
    if (maxValue <= minValue) {
      return Math.round((minSize + maxSize) / 2);
    }
    const normalized = (value - minValue) / (maxValue - minValue);
    return Math.round(minSize + normalized * (maxSize - minSize));
  };

  const getColor = (index: number) => {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Top Leaked Passwords</h3>
          <p className="text-sm text-muted">Most common passwords in database</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
          {data.length} passwords
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex flex-wrap items-center justify-center gap-4 p-4 min-h-[300px]"
      >
        {data.length === 0 ? (
          <div className="text-sm text-muted">No leaked passwords found</div>
        ) : (
          data.map((item, index) => (
            <div
              key={item.text}
              className="transition-all hover:scale-110 cursor-pointer"
              style={{
                fontSize: `${getSize(Number(item.value))}px`,
                color: getColor(index),
                fontWeight: 600,
                opacity: 0.9,
              }}
              title={`${item.text}: ${Number(item.value).toLocaleString()} occurrences`}
            >
              {item.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
