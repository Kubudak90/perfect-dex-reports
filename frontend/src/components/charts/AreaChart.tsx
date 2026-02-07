'use client';

import { useMemo } from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface DataPoint {
  date: string;
  value: number;
  timestamp: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function AreaChart({
  data,
  height = 300,
  color = 'rgb(59, 130, 246)', // blue-500
  showGrid = true,
  showAxes = true,
  valueFormatter = formatCurrency,
  className,
}: AreaChartProps) {
  const { pathD, areaD, points, minValue, maxValue, yTicks } = useMemo(() => {
    if (data.length === 0) {
      return { pathD: '', areaD: '', points: [], minValue: 0, maxValue: 0, yTicks: [] };
    }

    const values = data.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    // Calculate points
    const padding = 40;
    const chartWidth = 800;
    const chartHeight = height - padding * 2;
    const stepX = chartWidth / (data.length - 1 || 1);

    const points = data.map((d, i) => {
      const x = padding + i * stepX;
      const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
      return { x, y, value: d.value, date: d.date };
    });

    // Generate path for line
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Generate path for area (with bottom fill)
    const areaD =
      pathD +
      ` L ${points[points.length - 1].x} ${padding + chartHeight}` +
      ` L ${points[0].x} ${padding + chartHeight} Z`;

    // Y-axis ticks
    const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];

    return { pathD, areaD, points, minValue, maxValue, yTicks };
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

        {/* Area fill */}
        <path d={areaD} fill={color} fillOpacity={0.1} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill={color}
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
          </g>
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
