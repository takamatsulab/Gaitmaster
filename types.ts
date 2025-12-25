
export interface RawDataPoint {
  time: number;
  ax: number;
  ay: number;
  az: number;
}

export interface ProcessedDataPoint extends RawDataPoint {
  ayFiltered: number;
  axFiltered: number;
  azFiltered: number;
}

export type Side = 'Left' | 'Right';
export type LabelMode = 'physical' | 'functional';

export interface Peak {
  id: number;
  time: number;
  value: number;
  index: number;
  isExcluded: boolean;
  side: Side;
}

export interface StepMetric {
  stepNumber: number; 
  sideLabel: string;  
  duration: number;
  rmsX: number;
  rmsY: number;
  rmsZ: number;
  cadence: number;
  side: Side;        
}

export interface GaitMetrics {
  cadence: number;
  meanStepTime: number;
  stepTimeCV: number;      // 歩行時間の変動係数 (%)
  strideTime: number;      // ストライド時間 (s)
  rmsX: number;
  rmsY: number;
  rmsZ: number;
  rmsTotal: number;        // 合成加速度のRMS (Root Sum Square)
  strideCount: number;
  symmetryIndex: number;   // 時間の対称性
  rmsSymmetryY: number;    // 垂直方向の動揺の対称性
}

export interface NormalizedCycle {
  percent: number;
  mean: number;
  std: number;
}

export interface AnalysisResult {
  metrics: GaitMetrics;
  stepMetrics: StepMetric[];
  leftCycleY: NormalizedCycle[];
  rightCycleY: NormalizedCycle[];
  leftCycleX: NormalizedCycle[];
  rightCycleX: NormalizedCycle[];
  leftCycleZ: NormalizedCycle[];
  rightCycleZ: NormalizedCycle[];
  rawSegment: ProcessedDataPoint[];
  usedPeaks: Peak[];
}

export interface SavedTrial {
  id: string;
  subjectId: string;
  condition: string;
  trialNum: string;
  labelMode: LabelMode;
  dominantSide: Side;
  result: AnalysisResult;
  timestamp: number;
}
