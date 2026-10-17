import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface InventoryChartProps {
  data: { hospital_name: string; count: number; value: number }[];
  mode?: 'count' | 'value';
  height?: number;
}

export const InventoryChart: React.FC<InventoryChartProps> = ({
  data,
  mode = 'count',
  height = 300,
}) => {
  const colors = ['#0D9488', '#14B8A6', '#2DD4BF', '#06B6D4', '#3B82F6', '#6366F1'];

  const formatYAxis = (val: number) => {
    if (mode === 'value') {
      if (val >= 1000000) return `₹${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
      return `₹${val}`;
    }
    return val.toLocaleString();
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis
            dataKey="hospital_name"
            tick={{ fontSize: 11, fill: '#64748B' }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickFormatter={formatYAxis}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#F8FAFC' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                    <p className="font-semibold text-teal-300">{item.hospital_name}</p>
                    <p className="text-slate-300">
                      Inventory Count: <span className="font-bold text-white">{item.count.toLocaleString()}</span> units
                    </p>
                    <p className="text-slate-300">
                      Total Valuation: <span className="font-bold text-teal-400">₹{item.value.toLocaleString()}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey={mode}
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default InventoryChart;
