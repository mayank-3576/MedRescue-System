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

interface TransferStatusChartProps {
  data: { status: string; count: number }[];
  height?: number;
}

export const TransferStatusChart: React.FC<TransferStatusChartProps> = ({
  data,
  height = 280,
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return '#10B981';
      case 'in transit':
        return '#3B82F6';
      case 'pending approval':
      case 'pending':
        return '#F59E0B';
      default:
        return '#EF4444';
    }
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="status"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={95}
          />
          <Tooltip
            cursor={{ fill: '#F8FAFC' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs border border-slate-800">
                    <p className="font-semibold text-slate-200">{item.status}</p>
                    <p className="text-teal-400 font-bold mt-0.5">{item.count} transfers</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TransferStatusChart;
