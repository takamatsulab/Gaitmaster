
import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { NormalizedCycle } from '../types';

interface GaitCycleChartProps {
  leftData: NormalizedCycle[];
  rightData: NormalizedCycle[];
  title: string;
  labels: { sideA: string; sideB: string };
}

const GaitCycleChart: React.FC<GaitCycleChartProps> = ({ leftData, rightData, title, labels }) => {
  const combinedData = Array.from({ length: 100 }, (_, i) => ({
    percent: i,
    left: leftData[i]?.mean || 0,
    right: rightData[i]?.mean || 0,
  }));

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-80">
      <h3 className="text-sm font-semibold text-slate-500 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="percent" 
            label={{ value: '歩行周期 (%)', position: 'insideBottom', offset: -5, fontSize: 12 }}
          />
          <YAxis label={{ value: '加速度 (m/s²)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
          <Tooltip labelFormatter={(v) => `周期: ${v}%`} />
          <Legend verticalAlign="top" height={36}/>
          <Area 
            name={`${labels.sideA} 平均`}
            type="monotone" 
            dataKey="left" 
            stroke="#ef4444" 
            fill="#fee2e2" 
            strokeWidth={2}
          />
          <Area 
            name={`${labels.sideB} 平均`}
            type="monotone" 
            dataKey="right" 
            stroke="#3b82f6" 
            fill="#dbeafe" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GaitCycleChart;
