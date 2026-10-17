import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ExpiryDistributionChartProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
}

export const ExpiryDistributionChart: React.FC<ExpiryDistributionChartProps> = ({
  data,
  height = 280,
}) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                const percent = ((item.value / total) * 100).toFixed(1);
                return (
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-200">{item.name}</span>
                    </div>
                    <p className="text-slate-300">
                      Batches: <strong className="text-white">{item.value}</strong> ({percent}%)
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExpiryDistributionChart;
