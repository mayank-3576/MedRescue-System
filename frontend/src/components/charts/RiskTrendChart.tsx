import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RiskTrendChartProps {
  data: { month: string; saved_value: number; expired_value: number }[];
  height?: number;
}

export const RiskTrendChart: React.FC<RiskTrendChartProps> = ({
  data,
  height = 300,
}) => {
  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `₹${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
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
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800">
                    <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">
                      {label} Financial Impact
                    </p>
                    <p className="text-emerald-400">
                      Saved Value: <strong className="text-white">₹{payload[0]?.value?.toLocaleString()}</strong>
                    </p>
                    <p className="text-rose-400">
                      Expired Waste: <strong className="text-white">₹{payload[1]?.value?.toLocaleString()}</strong>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
          />
          <Line
            type="monotone"
            dataKey="saved_value"
            name="Saved via Redistribution"
            stroke="#10B981"
            strokeWidth={3}
            dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="expired_value"
            name="Expired Loss"
            stroke="#F43F5E"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: '#F43F5E' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiskTrendChart;
