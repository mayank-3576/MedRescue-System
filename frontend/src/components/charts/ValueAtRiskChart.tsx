import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ValueAtRiskChartProps {
  data: { date: string; value: number }[];
  height?: number;
}

export const ValueAtRiskChart: React.FC<ValueAtRiskChartProps> = ({
  data,
  height = 250,
}) => {
  const formatYAxis = (val: number) => {
    if (val >= 100000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickFormatter={formatYAxis}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                    <p className="text-slate-400 font-medium">{label}</p>
                    <p className="text-red-400 font-bold text-sm">
                      ₹{payload[0]?.value?.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">Total Medicine Value at Expiry Risk</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#EF4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorRisk)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ValueAtRiskChart;
