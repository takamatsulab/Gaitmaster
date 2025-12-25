
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

  // 0から100まで5刻みの配列を生成
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div className="flex flex-col h-full w-full">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">{title}</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={combinedData} margin={{ top: 0, right: 20, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
            <XAxis 
              dataKey="percent" 
              type="number"
              domain={[0, 100]}
              ticks={ticks}
              tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
              label={{ value: 'STRIDE CYCLE (踵接地 0% → 次の同側踵接地 100%)', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 800, fill: '#64748b', letterSpacing: '0.05em' }}
              axisLine={{ stroke: '#f1f5f9' }}
              tickLine={{ stroke: '#f1f5f9' }}
            />
            <YAxis 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#cbd5e1' }}
              label={{ value: 'ACCELERATION (m/s²)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 800, fill: '#94a3b8', letterSpacing: '0.1em' }}
              axisLine={{ stroke: '#f1f5f9' }}
              tickLine={false}
            />
            <Tooltip 
              labelFormatter={(v) => `Stride progress: ${v}%`}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
              itemStyle={{ fontSize: '12px', fontWeight: 700 }}
            />
            <Legend verticalAlign="top" height={50} iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }} />
            <Area 
              name={`${labels.sideA} STRIDE MEAN`}
              type="monotone" 
              dataKey="left" 
              stroke="#ef4444" 
              fill="url(#colorLeft)" 
              strokeWidth={3}
              isAnimationActive={false}
              connectNulls={true}
            />
            <Area 
              name={`${labels.sideB} STRIDE MEAN`}
              type="monotone" 
              dataKey="right" 
              stroke="#3b82f6" 
              fill="url(#colorRight)" 
              strokeWidth={3}
              isAnimationActive={false}
              connectNulls={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GaitCycleChart;
