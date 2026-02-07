'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface DataPoint {
  date: string;
  value: number;
  timestamp: number;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function BarChart({
  data,
  height = 300,
  color = 'rgb(139, 92, 246)', // violet-500
  showGrid = true,
  showAxes = true,
  valueFormatter = formatCurrency,
  className,
}: BarChartProps) {
  const { bars, minValue, maxValue, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return { bars: [], minValue: 0, maxValue: 0, yTicks: [] };
    }

    const values = data.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    // Calculate bars
    const padding = 40;
    const chartWidth = 800;
    const chartHeight = height - padding * 2;
    const barWidth = chartWidth / data.length - 4; // 4px gap

    const bars = data.map((d, i) => {
      const x = padding + (i * chartWidth) / data.length;
      const barHeight = ((d.value - minValue) / range) * chartHeight;
      const y = padding + chartHeight - barHeight;
      return { x, y, width: barWidth, height: barHeight, value: d.value, date: d.date };
    });

    // Y-axis ticks
    const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];

    return { bars, minValue, maxValue, yTicks };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 840 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-10">
            {yTicks.map((tick, i) => {
              const y = 40 + ((2 - i) / 2) * (height - 80);
              return (
                <line
                  key={i}
                  x1={40}
                  y1={y}
                  x2={840}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth={1}
                />
              );
            })}
          </g>
        )}

        {/* Bars */}
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={color}
            opacity={0.8}
            className="hover:opacity-100 transition-opacity"
            rx={2}
          />
        ))}
      </svg>

      {/* Y-axis labels */}
      {showAxes && (
        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-10 text-xs text-muted-foreground">
          {yTicks.map((tick, i) => (
            <div key={i} className="text-right pr-2">
              {valueFormatter(tick)}
            </div>
          ))}
        </div>
      )}

      {/* X-axis labels */}
      {showAxes && data.length > 0 && (
        <div className="absolute bottom-0 left-10 right-0 flex justify-between px-10 text-xs text-muted-foreground">
          <div>{data[0].date}</div>
          {data.length > 2 && (
            <div>{data[Math.floor(data.length / 2)].date}</div>
          )}
          <div>{data[data.length - 1].date}</div>
        </div>
      )}
    </div>
  );
}
