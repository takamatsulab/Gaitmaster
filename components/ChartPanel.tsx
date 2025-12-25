
import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceDot, ReferenceLine
} from 'recharts';
import { ProcessedDataPoint, Peak } from '../types';

interface ChartPanelProps {
  data: ProcessedDataPoint[];
  title: string;
  dataKey: keyof ProcessedDataPoint;
  color: string;
  selection?: [number, number];
  peaks?: Peak[];
  onChartClick?: (time: number, value: number) => void;
  zoomMode?: boolean;
  threshold?: number; // 解析用のしきい値ライン
}

const ChartPanel: React.FC<ChartPanelProps> = ({ 
  data, title, dataKey, color, selection, peaks, onChartClick, zoomMode = false, threshold
}) => {
  const xDomain = (zoomMode && selection) ? [selection[0], selection[1]] : ['auto', 'auto'];

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-72">
      <h3 className="text-sm font-semibold text-slate-500 mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          onClick={(e) => {
            if (e && e.activeLabel && onChartClick) {
              const point = data.find(d => d.time === Number(e.activeLabel));
              if (point) onChartClick(point.time, point[dataKey] as number);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={xDomain as any} 
            allowDataOverflow={true}
            tick={{ fontSize: 10 }}
            label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 10 }}
          />
          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip 
            labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          {threshold && (
            <ReferenceLine y={threshold} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'TH', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
          )}
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            dot={false} 
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          {selection && !zoomMode && (
            <ReferenceArea 
              x1={selection[0]} 
              x2={selection[1]} 
              fill="#3b82f6" 
              fillOpacity={0.05} 
              stroke="#3b82f6" 
              strokeDasharray="3 3"
            />
          )}
          {peaks?.filter(p => !p.isExcluded).map(p => (
            <ReferenceDot 
              key={p.id} 
              x={p.time} 
              y={p.value} 
              r={4} 
              fill={p.side === 'Left' ? '#ef4444' : '#3b82f6'} 
              stroke="none" 
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartPanel;
