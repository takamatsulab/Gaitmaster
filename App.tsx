
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, Activity, ChevronRight, 
  Trash2, Info, BrainCircuit, CheckCircle2,
  Settings2, Download, RefreshCcw, PlayCircle, PlusCircle, Loader2, AlertCircle,
  RotateCcw, ArrowLeft, Clock, Maximize2, MousePointer2, Crosshair, ZoomIn, ZoomOut, ArrowLeftRight,
  Footprints, UserCircle, FileSpreadsheet, FileText, BarChart3, Save, ListChecks, History, Eraser, UserPlus, FileDown,
  TrendingUp, Zap, Scale, Target, Settings, Database, Beaker
} from 'lucide-react';
import { 
  RawDataPoint, ProcessedDataPoint, Peak, 
  AnalysisResult, NormalizedCycle, GaitMetrics, LabelMode, Side, StepMetric, SavedTrial 
} from './types';
import { 
  lowPassFilter, findPeaks, calculateRMS, calculateStd,
  normalizeGaitCycle 
} from './services/mathUtils';
import { getGaitInsights } from './services/geminiService';
import ChartPanel from './components/ChartPanel';
import GaitCycleChart from './components/GaitCycleChart';

const App: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [processedData, setProcessedData] = useState<ProcessedDataPoint[]>([]);
  
  const [subjectId, setSubjectId] = useState<string>('Sub01');
  const [condition, setCondition] = useState<string>('Control');
  const [trialNum, setTrialNum] = useState<string>('Trial1');
  const [labelMode, setLabelMode] = useState<LabelMode>('physical');
  const [dominantSide, setDominantSide] = useState<Side>('Right');

  const [savedTrials, setSavedTrials] = useState<SavedTrial[]>([]);

  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [threshold, setThreshold] = useState<number | undefined>(undefined);
  const [startWithLeft, setStartWithLeft] = useState<boolean>(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickingMode, setPickingMode] = useState<'none' | 'start' | 'end'>('none');
  const [zoomMode, setZoomMode] = useState<boolean>(true);

  const labels = React.useMemo(() => {
    if (labelMode === 'physical') {
      return { sideA: 'Left', sideB: 'Right' };
    } else {
      return {
        sideA: dominantSide === 'Left' ? 'Dominant' : 'NonDominant',
        sideB: dominantSide === 'Right' ? 'Dominant' : 'NonDominant',
      };
    }
  }, [labelMode, dominantSide]);

  const reorderPeaks = useCallback((rawPeaks: Peak[], startingLeft: boolean) => {
    return [...rawPeaks]
      .sort((a, b) => a.time - b.time)
      .map((p, i) => ({
        ...p,
        side: (i % 2 === 0 ? (startingLeft ? 'Left' : 'Right') : (startingLeft ? 'Right' : 'Left')) as Side
      }));
  }, []);

  useEffect(() => {
    if (peaks.length > 0) {
      setPeaks(prev => reorderPeaks(prev, startWithLeft));
    }
  }, [startWithLeft, reorderPeaks]);

  const generateSampleData = () => {
    setError(null);
    const data: RawDataPoint[] = [];
    const fs = 50; 
    const duration = 40;
    const walkingFreq = 1.6 + Math.random() * 0.4;
    for (let i = 0; i < duration * fs; i++) {
      const t = i / fs;
      const intensity = (t < 5 || t > 35) ? 0.2 : 1.0;
      const ay = 9.8 + (2.5 * Math.sin(2 * Math.PI * walkingFreq * t) + (Math.random() - 0.5) * 0.8) * intensity;
      const ax = (0.6 * Math.sin(Math.PI * walkingFreq * t) + (Math.random() - 0.5) * 0.5) * intensity;
      const az = (1.2 * Math.sin(2 * Math.PI * walkingFreq * t - Math.PI/3) + (Math.random() - 0.5) * 0.4) * intensity;
      data.push({ time: t, ax, ay, az });
    }
    processLoadedData(data);
  };

  const processLoadedData = (parsed: RawDataPoint[]) => {
    if (parsed.length < 10) {
      setError("データが不十分です。");
      return;
    }
    try {
      const dt = parsed[1].time - parsed[0].time;
      const fs = 1.0 / dt;
      const ayFiltered = lowPassFilter(parsed.map(p => p.ay), 10, fs);
      const axFiltered = lowPassFilter(parsed.map(p => p.ax), 10, fs);
      const azFiltered = lowPassFilter(parsed.map(p => p.az), 10, fs);
      const processed = parsed.map((p, idx) => ({
        ...p,
        ayFiltered: ayFiltered[idx],
        axFiltered: axFiltered[idx],
        azFiltered: azFiltered[idx]
      }));
      setProcessedData(processed);
      setSelection([parsed[0].time, parsed[parsed.length - 1].time]);
      setStep(2);
      setError(null);
    } catch (e) {
      setError("解析エラーが発生しました。");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        const parsed: RawDataPoint[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim());
          if (parts.length < 4) continue;
          parsed.push({ time: parseFloat(parts[0]), ax: parseFloat(parts[1]), ay: parseFloat(parts[2]), az: parseFloat(parts[3]) });
        }
        processLoadedData(parsed);
      } catch (err) {
        setError("CSVの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  const detectSteps = useCallback(() => {
    if (!selection || processedData.length === 0) return;
    
    const segment = processedData.filter(p => p.time >= selection[0] && p.time <= selection[1]);
    if (segment.length < 10) return;

    const fs = 1.0 / (segment[1].time - segment[0].time);
    const ay = segment.map(s => s.ayFiltered);
    
    const mean = ay.reduce((a,b)=>a+b,0)/ay.length;
    const std = calculateStd(ay);
    const calculatedThreshold = mean + std * 0.7;
    setThreshold(calculatedThreshold);

    const minDist = Math.round(0.35 * fs);
    const indices = findPeaks(ay, calculatedThreshold, minDist);
    
    const detected = indices.map((idx, i) => ({
      id: Date.now() + i,
      time: segment[idx].time,
      value: segment[idx].ayFiltered,
      index: idx,
      isExcluded: false,
      side: 'Left' as Side
    }));
    setPeaks(reorderPeaks(detected, startWithLeft));
  }, [selection, processedData, startWithLeft, reorderPeaks]);

  const handleChartInteraction = (t: number, v: number) => {
    if (pickingMode === 'start') {
      setSelection([t, selection ? Math.max(t, selection[1]) : t]);
      setPickingMode('none');
    } else if (pickingMode === 'end') {
      setSelection([selection ? Math.min(t, selection[0]) : t, t]);
      setPickingMode('none');
    } else {
      const existingPeak = peaks.find(p => Math.abs(p.time - t) < 0.2);
      if (existingPeak) {
        setPeaks(prev => reorderPeaks(prev.filter(p => p.id !== existingPeak.id), startWithLeft));
      } else {
        const newPeak: Peak = {
          id: Date.now(), time: t, value: v, index: -1, isExcluded: false, side: 'Left'
        };
        setPeaks(prev => reorderPeaks([...prev, newPeak], startWithLeft));
      }
    }
  };

  const runFullAnalysis = async () => {
    setIsProcessing(true);
    try {
      const activePeaks = peaks.filter(p => !p.isExcluded);
      if (activePeaks.length < 21) throw new Error("解析には少なくとも21個のピークが必要です。");
      
      const startIdx = Math.floor((activePeaks.length - 21) / 2);
      const usedPeaks = activePeaks.slice(startIdx, startIdx + 21);

      const segment = processedData.filter(p => p.time >= usedPeaks[0].time && p.time <= usedPeaks[usedPeaks.length-1].time);
      const stepMetrics: StepMetric[] = [];
      
      for(let i = 1; i < usedPeaks.length; i++) {
        const pPrev = usedPeaks[i-1];
        const pCurr = usedPeaks[i];
        const duration = pCurr.time - pPrev.time;
        const stepData = processedData.filter(d => d.time >= pPrev.time && d.time < pCurr.time);
        
        let sideLabel = labelMode === 'physical' 
          ? pPrev.side 
          : (pPrev.side === dominantSide ? 'Dominant' : 'NonDominant');

        stepMetrics.push({
          stepNumber: i, sideLabel, duration,
          rmsX: calculateRMS(stepData.map(d => d.axFiltered)),
          rmsY: calculateRMS(stepData.map(d => d.ayFiltered)),
          rmsZ: calculateRMS(stepData.map(d => d.azFiltered)),
          cadence: 60 / (duration > 0 ? duration : 0.5), side: pPrev.side
        });
      }

      const durations = stepMetrics.map(m => m.duration);
      const meanStepTime = durations.reduce((a,b)=>a+b,0)/durations.length;
      const stdStepTime = calculateStd(durations);
      const stepTimeCV = meanStepTime > 0 ? (stdStepTime / meanStepTime) * 100 : 0;

      const leftSteps = stepMetrics.filter(m => m.side === 'Left');
      const rightSteps = stepMetrics.filter(m => m.side === 'Right');
      const avgL = leftSteps.length > 0 ? leftSteps.reduce((a,b)=>a+b.duration,0)/leftSteps.length : meanStepTime;
      const avgR = rightSteps.length > 0 ? rightSteps.reduce((a,b)=>a+b.duration,0)/rightSteps.length : meanStepTime;
      const symmetry = (1 - Math.abs(avgL - avgR) / (avgL + avgR + 0.0001)) * 100;

      const rmsYL = leftSteps.length > 0 ? leftSteps.reduce((a,b)=>a+b.rmsY,0)/leftSteps.length : 0.1;
      const rmsYR = rightSteps.length > 0 ? rightSteps.reduce((a,b)=>a+b.rmsY,0)/rightSteps.length : 0.1;
      const rmsSymmetryY = (1 - Math.abs(rmsYL - rmsYR) / (rmsYL + rmsYR + 0.0001)) * 100;

      const rmsX = calculateRMS(segment.map(s => s.axFiltered));
      const rmsY = calculateRMS(segment.map(s => s.ayFiltered));
      const rmsZ = calculateRMS(segment.map(s => s.azFiltered));
      const rmsTotal = Math.sqrt(rmsX*rmsX + rmsY*rmsY + rmsZ*rmsZ);

      const metrics: GaitMetrics = {
        cadence: meanStepTime > 0 ? 60 / (meanStepTime * 2) : 0, 
        meanStepTime,
        stepTimeCV,
        strideTime: meanStepTime * 2,
        rmsX, rmsY, rmsZ, rmsTotal,
        strideCount: 10, 
        symmetryIndex: symmetry,
        rmsSymmetryY
      };

      const normalize = (side: Side, key: 'ayFiltered' | 'axFiltered' | 'azFiltered') => {
        const cycles = [];
        for (let i = 0; i < usedPeaks.length - 2; i++) {
          if (usedPeaks[i].side === side) {
            const cycleSeg = segment.filter(s => s.time >= usedPeaks[i].time && s.time <= usedPeaks[i+2].time);
            if (cycleSeg.length > 5) cycles.push(normalizeGaitCycle(cycleSeg.map(s => s[key]), 100));
          }
        }
        return Array.from({length: 100}, (_, i) => ({
          percent: i, 
          mean: cycles.length > 0 ? cycles.reduce((acc, c) => acc + (c[i] || 0), 0) / cycles.length : 0, 
          std: 0
        }));
      };

      setResult({
        metrics, stepMetrics,
        leftCycleY: normalize('Left', 'ayFiltered'), rightCycleY: normalize('Right', 'ayFiltered'),
        leftCycleX: normalize('Left', 'axFiltered'), rightCycleX: normalize('Right', 'axFiltered'),
        leftCycleZ: normalize('Left', 'azFiltered'), rightCycleZ: normalize('Right', 'azFiltered'),
        rawSegment: segment, usedPeaks
      });
      setStep(3);
    } catch (e) {
      alert(e instanceof Error ? e.message : "解析エラーが発生しました。");
    } finally { setIsProcessing(false); }
  };

  const fetchAiInsights = async () => {
    if (!result) return;
    setIsLoadingAi(true);
    try {
      const insight = await getGaitInsights(result.metrics, subjectId, labels);
      setAiInsight(insight);
    } catch (err) { setAiInsight("AI解析中にエラーが発生しました。"); } finally { setIsLoadingAi(false); }
  };

  const saveCurrentTrial = () => {
    if (!result) return;
    setSavedTrials(prev => [...prev, {
      id: Date.now().toString(), subjectId, condition, trialNum, labelMode, dominantSide, result, timestamp: Date.now()
    }]);
    setProcessedData([]); setSelection(null); setPeaks([]); setThreshold(undefined); setResult(null); setAiInsight('');
    const match = trialNum.match(/\d+/);
    if (match) {
      setTrialNum(trialNum.replace(match[0], (parseInt(match[0]) + 1).toString()));
    }
    setStep(1);
  };

  const resetAllTrials = () => {
    if (savedTrials.length > 0 && confirm("すべての解析済みデータを削除しますか？")) {
      setSavedTrials([]);
    }
  };

  const downloadCSV = (filename: string, header: string[], rows: any[][]) => {
    const csvContent = [
      header.join(","),
      ...rows.map(row => row.map(val => (val === null || val === undefined) ? "" : `"${val}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const downloadAggregatedSummary = () => {
    if (savedTrials.length === 0) return;
    const header = ["Subject_ID", "Condition", "Trial", "Timestamp", "Cadence", "StepTime_Avg", "StrideTime_Avg", "StepTime_CV", "Symmetry_Time", "RMS_Total", "RMS_X", "RMS_Y", "RMS_Z"];
    const rows = savedTrials.map(t => [
      t.subjectId, t.condition, t.trialNum, new Date(t.timestamp).toLocaleString(),
      t.result.metrics.cadence.toFixed(4), t.result.metrics.meanStepTime.toFixed(4), t.result.metrics.strideTime.toFixed(4), 
      t.result.metrics.stepTimeCV.toFixed(4), t.result.metrics.symmetryIndex.toFixed(2),
      t.result.metrics.rmsTotal.toFixed(6), t.result.metrics.rmsX.toFixed(6), t.result.metrics.rmsY.toFixed(6), t.result.metrics.rmsZ.toFixed(6)
    ]);
    downloadCSV(`${subjectId}_${condition}_Aggregated_Summary.csv`, header, rows);
  };

  const downloadAggregatedStepDetails = () => {
    if (savedTrials.length === 0) return;
    const header = ["Subject_ID", "Condition", "Trial", "Step_No", "Side", "Duration", "RMS_X", "RMS_Y", "RMS_Z", "Cadence"];
    const rows: any[][] = [];
    savedTrials.forEach(t => {
      t.result.stepMetrics.forEach(m => {
        rows.push([
          t.subjectId, t.condition, t.trialNum, m.stepNumber, m.sideLabel,
          m.duration.toFixed(6), m.rmsX.toFixed(6), m.rmsY.toFixed(6), m.rmsZ.toFixed(6), m.cadence.toFixed(4)
        ]);
      });
    });
    downloadCSV(`${subjectId}_${condition}_Aggregated_StepDetails.csv`, header, rows);
  };

  const downloadAggregatedGaitCycles = () => {
    if (savedTrials.length === 0) return;
    const header = ["Subject_ID", "Condition", "Trial", "Side", "Percent", "Acc_X_Mean", "Acc_Y_Mean", "Acc_Z_Mean"];
    const rows: any[][] = [];
    savedTrials.forEach(t => {
      ['Left', 'Right'].forEach(side => {
        const sidePrefix = side === 'Left' ? 'leftCycle' : 'rightCycle';
        const sideLabel = t.labelMode === 'physical' 
          ? side 
          : (side === t.dominantSide ? 'Dominant' : 'NonDominant');
        
        const dataX = t.result[`${sidePrefix}X` as keyof AnalysisResult] as NormalizedCycle[];
        const dataY = t.result[`${sidePrefix}Y` as keyof AnalysisResult] as NormalizedCycle[];
        const dataZ = t.result[`${sidePrefix}Z` as keyof AnalysisResult] as NormalizedCycle[];

        if (dataX && dataY && dataZ) {
          for (let i = 0; i < 100; i++) {
            rows.push([
              t.subjectId, t.condition, t.trialNum, sideLabel, i,
              dataX[i]?.mean?.toFixed(6) || "0",
              dataY[i]?.mean?.toFixed(6) || "0",
              dataZ[i]?.mean?.toFixed(6) || "0",
            ]);
          }
        }
      });
    });
    downloadCSV(`${subjectId}_${condition}_Aggregated_NormalizedCycles.csv`, header, rows);
  };

  const downloadCurrentTrialCSV = () => {
    if (!result) return;
    const header = ["Subject_ID", "Condition", "Trial", "Step_No", "Side", "Duration", "RMS_X", "RMS_Y", "RMS_Z", "Cadence"];
    const rows = result.stepMetrics.map(m => [
      subjectId, condition, trialNum, m.stepNumber, m.sideLabel,
      m.duration.toFixed(6), m.rmsX.toFixed(6), m.rmsY.toFixed(6), m.rmsZ.toFixed(6), m.cadence.toFixed(4)
    ]);
    downloadCSV(`${subjectId}_${condition}_${trialNum}_Details.csv`, header, rows);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            GaitMaster <span className="text-indigo-600">Lab</span>
          </h1>
        </div>
        <div className="flex gap-6">
          {['Session Setup', 'Data Cleaning', 'Analysis Report'].map((l, i) => (
            <div key={l} className={`flex items-center gap-3 text-sm font-bold transition-all duration-300 ${step === i+1 ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all ${step === i+1 ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>{i+1}</div>
              <span className="hidden sm:inline">{l}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-8 space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900">Start New Session</h2>
                <p className="text-slate-500 font-medium">解析対象の情報を入力し、加速度データをアップロードしてください。</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Section 1: Identifier */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <UserCircle className="w-24 h-24" />
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-lg"><Database className="w-5 h-5 text-indigo-600" /></div>
                    <h3 className="text-lg font-bold text-slate-800">1. 被験者・条件設定</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        {/* Use a span wrapper to provide a tooltip title since Lucide icons do not support the title prop directly */}
                        Subject ID <span title="解析対象者を識別するID（例: P001）"><Info className="w-3 h-3 cursor-help" /></span>
                      </label>
                      <input 
                        type="text" 
                        value={subjectId} 
                        onChange={e=>setSubjectId(e.target.value)} 
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                        placeholder="例: Subject-01"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        {/* Use a span wrapper to provide a tooltip title since Lucide icons do not support the title prop directly */}
                        Analysis Condition <span title="歩行条件（例: 裸足、装具あり）"><Info className="w-3 h-3 cursor-help" /></span>
                      </label>
                      <input 
                        type="text" 
                        value={condition} 
                        placeholder="例: Normal Walk" 
                        onChange={e=>setCondition(e.target.value)} 
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Clinical Config */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Beaker className="w-24 h-24" />
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-50 p-2 rounded-lg"><Settings className="w-5 h-5 text-amber-600" /></div>
                    <h3 className="text-lg font-bold text-slate-800">2. プロトコル設定</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Trial Number</label>
                        <input 
                          type="text" 
                          value={trialNum} 
                          onChange={e=>setTrialNum(e.target.value)} 
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Labeling Mode</label>
                        <div className="flex p-1 bg-slate-100 rounded-2xl">
                          <button 
                            onClick={() => setLabelMode('physical')} 
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${labelMode === 'physical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            左右 (Left/Right)
                          </button>
                          <button 
                            onClick={() => setLabelMode('functional')} 
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${labelMode === 'functional' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            機能 (Dominant)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-end">
                      {labelMode === 'functional' ? (
                        <div className="bg-amber-50 p-6 rounded-[1.5rem] border border-amber-100 space-y-4 animate-in fade-in zoom-in-95">
                          <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest text-center block">利き足を選択してください</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => setDominantSide('Left')} 
                              className={`py-4 rounded-xl text-xs font-black transition-all border-2 ${dominantSide === 'Left' ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white border-amber-200 text-amber-400'}`}
                            >
                              左足
                            </button>
                            <button 
                              onClick={() => setDominantSide('Right')} 
                              className={`py-4 rounded-xl text-xs font-black transition-all border-2 ${dominantSide === 'Right' ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white border-amber-200 text-amber-400'}`}
                            >
                              右足
                            </button>
                          </div>
                          <p className="text-[10px] text-amber-600 text-center font-medium italic">※機能的ラベル（利き足・非利き足）で出力されます</p>
                        </div>
                      ) : (
                        <div className="bg-indigo-50 p-6 rounded-[1.5rem] border border-indigo-100 flex flex-col items-center justify-center text-center space-y-2">
                          <Footprints className="w-8 h-8 text-indigo-400 opacity-50" />
                          <p className="text-xs font-bold text-indigo-900 tracking-tight">物理的ラベルを使用</p>
                          <p className="text-[10px] text-indigo-400 leading-tight">左右の足を個別に解析・比較します。</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Data Source */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="group relative cursor-pointer">
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    <div className="h-full bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4 border-4 border-transparent hover:border-indigo-400">
                      <div className="bg-white/20 p-4 rounded-3xl group-hover:scale-110 transition-transform">
                        <Upload className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-xl font-black">Upload CSV Data</p>
                        <p className="text-indigo-100 text-xs mt-1 opacity-80 font-medium">スマホで計測したCSVを選択</p>
                      </div>
                    </div>
                  </label>

                  <button 
                    onClick={generateSampleData} 
                    className="group h-full bg-white p-8 rounded-[2.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4"
                  >
                    <div className="bg-slate-100 p-4 rounded-3xl group-hover:bg-indigo-100 transition-colors">
                      <PlayCircle className="w-10 h-10 text-slate-400 group-hover:text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-600 group-hover:text-indigo-600">Sample Simulation</p>
                      <p className="text-slate-400 text-xs mt-1 font-medium group-hover:text-indigo-400">擬似データで機能を試す</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar: History */}
            <div className="lg:col-span-4 space-y-6 sticky top-28 animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Session History</h3>
                  </div>
                  <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full">{savedTrials.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[200px]">
                  {savedTrials.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-300 space-y-4">
                      <div className="bg-slate-50 p-6 rounded-full"><ListChecks className="w-10 h-10 opacity-20" /></div>
                      <p className="text-xs font-bold text-slate-400">履歴はまだありません</p>
                    </div>
                  ) : (
                    savedTrials.map((t) => (
                      <div key={t.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.subjectId}</p>
                          </div>
                          <p className="text-xs font-bold text-slate-700 leading-none">{t.condition} - {t.trialNum}</p>
                        </div>
                        <button 
                          onClick={() => setSavedTrials(prev => prev.filter(p=>p.id!==t.id))} 
                          className="text-slate-200 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {savedTrials.length > 0 && (
                  <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-3 text-center tracking-widest">Aggregated Export</p>
                    <button onClick={downloadAggregatedSummary} className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                      <FileText className="w-4 h-4" /> 統合サマリー
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={downloadAggregatedStepDetails} className="py-3 bg-white border border-slate-200 text-indigo-600 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all">
                        ステップ詳細
                      </button>
                      <button onClick={downloadAggregatedGaitCycles} className="py-3 bg-white border border-slate-200 text-amber-600 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-all">
                        正規化波形
                      </button>
                    </div>
                    <button onClick={resetAllTrials} className="w-full py-2 text-[10px] font-bold text-slate-300 hover:text-red-400 transition-all flex items-center justify-center gap-1 mt-2">
                      <Eraser className="w-3 h-3" /> 履歴を全削除
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <button onClick={() => setStep(1)} className="p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600 bg-slate-50 border border-slate-100"><ArrowLeft className="w-5 h-5" /></button>
                  <div>
                    <h2 className="font-black text-slate-900 uppercase tracking-tighter leading-tight">Data Cleaning</h2>
                    <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase">{subjectId} — {trialNum}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setZoomMode(!zoomMode)} className={`px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all ${zoomMode ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {zoomMode ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />} Zoom Focus
                  </button>
                  <button onClick={detectSteps} className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 border-none transition-all shadow-lg shadow-slate-200">
                    <RefreshCcw className="w-4 h-4" /> Auto Detect
                  </button>
                  <button onClick={runFullAnalysis} className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                    Run Analysis
                  </button>
                </div>
              </div>
              {processedData.length > 0 && (
                <div className="space-y-6">
                  <ChartPanel 
                    data={processedData} title="垂直加速度 (Vertical AY) - ピーク検出" dataKey="ayFiltered" color="#4F46E5" 
                    selection={selection || undefined} peaks={peaks} 
                    onChartClick={handleChartInteraction}
                    zoomMode={zoomMode}
                    threshold={threshold}
                  />
                  <ChartPanel 
                    data={processedData} title="左右加速度 (Lateral AX) - 体幹動揺" dataKey="axFiltered" color="#F43F5E" 
                    selection={selection || undefined} 
                    zoomMode={zoomMode}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Clock className="w-4 h-4" /> Selection Tools</h3>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setPickingMode('start')} className={`py-3 rounded-2xl text-[11px] font-black border transition-all ${pickingMode === 'start' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>START POINT</button>
                   <button onClick={() => setPickingMode('end')} className={`py-3 rounded-2xl text-[11px] font-black border transition-all ${pickingMode === 'end' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>END POINT</button>
                </div>
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                  <p className="text-[10px] text-indigo-600 leading-relaxed font-bold">
                    <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded mr-1">TIPS</span>
                    グラフを直接クリックするとピークの追加/削除が可能です。
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col flex-1 max-h-[500px]">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-5 flex items-center justify-between tracking-widest">
                  <span>Detected Peaks ({peaks.length})</span>
                  <button onClick={() => setStartWithLeft(!startWithLeft)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg" title="最初の足を入れ替え">
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {peaks.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shadow-sm ${p.side === 'Left' ? 'bg-rose-500 ring-4 ring-rose-100' : 'bg-blue-500 ring-4 ring-blue-100'}`} />
                        <span className="text-xs font-black text-slate-700">{p.time.toFixed(3)}s</span>
                        <span className="text-[9px] font-black text-slate-300 px-1.5 py-0.5 bg-white rounded-md border border-slate-100">{p.side.toUpperCase()}</span>
                      </div>
                      <button onClick={() => setPeaks(prev => reorderPeaks(prev.filter(pk => pk.id !== p.id), startWithLeft))} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center shadow-inner relative">
                   <CheckCircle2 className="text-emerald-500 w-10 h-10" />
                   <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Analysis Result</h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{subjectId}</span>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{condition}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={downloadCurrentTrialCSV} className="flex-1 md:flex-none px-6 py-4 border-2 border-slate-100 rounded-[1.5rem] hover:bg-slate-50 text-slate-600 transition-all flex items-center justify-center gap-3 font-bold text-sm">
                  <FileDown className="w-5 h-5 text-indigo-500" /> Export CSV
                </button>
                <button onClick={saveCurrentTrial} className="flex-1 md:flex-none px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 text-lg">
                  <Save className="w-6 h-6" /> Save Session
                </button>
                <button onClick={() => setStep(2)} className="p-4 border-2 border-slate-100 rounded-[1.5rem] hover:bg-slate-50 text-slate-400 transition-all"><RotateCcw className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-50/50 rounded-full group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2 relative">
                  <Clock className="w-4 h-4 text-indigo-400" /> Gait Variability (CV)
                </p>
                <div className="relative">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{result.metrics.stepTimeCV.toFixed(2)}<span className="text-lg ml-1 font-bold text-slate-400">%</span></p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className={`h-2 flex-1 rounded-full bg-slate-100 overflow-hidden`}>
                      <div className={`h-full transition-all duration-1000 ${result.metrics.stepTimeCV < 3 ? 'bg-emerald-500 w-[30%]' : 'bg-rose-500 w-[70%]'}`} />
                    </div>
                    <span className={`text-[10px] font-black ${result.metrics.stepTimeCV < 3 ? 'text-emerald-600' : 'text-rose-600'}`}>{result.metrics.stepTimeCV < 3 ? 'STABLE' : 'RISK'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-50/50 rounded-full group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2 relative">
                  <Zap className="w-4 h-4 text-amber-400" /> RSS Magnitude
                </p>
                <div className="relative">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{result.metrics.rmsTotal.toFixed(3)}<span className="text-lg ml-1 font-bold text-slate-400">m/s²</span></p>
                  <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase">Root Sum Square Acceleration</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50/50 rounded-full group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2 relative">
                  <Target className="w-4 h-4 text-emerald-400" /> Stride Interval
                </p>
                <div className="relative">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{result.metrics.strideTime.toFixed(3)}<span className="text-lg ml-1 font-bold text-slate-400">s</span></p>
                  <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase">Time for two consecutive steps</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-50/50 rounded-full group-hover:scale-125 transition-transform duration-500" />
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2 relative">
                  <Scale className="w-4 h-4 text-rose-400" /> Power Symmetry
                </p>
                <div className="relative">
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{result.metrics.rmsSymmetryY.toFixed(1)}<span className="text-lg ml-1 font-bold text-slate-400">%</span></p>
                  <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase">Vertical acceleration balance</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { l: '歩行率', v: result.metrics.cadence.toFixed(1), u: 'steps/min' },
                { l: '1歩時間', v: result.metrics.meanStepTime.toFixed(3), u: 's' },
                { l: '時間対称性', v: result.metrics.symmetryIndex.toFixed(1), u: '%' },
                { l: '左右動揺', v: result.metrics.rmsX.toFixed(3), u: 'RMS' },
                { l: '垂直動揺', v: result.metrics.rmsY.toFixed(3), u: 'RMS' },
                { l: '推進力', v: result.metrics.rmsZ.toFixed(3), u: 'RMS' },
              ].map(m => (
                <div key={m.l} className="bg-white p-5 rounded-2xl border border-slate-100 text-center hover:bg-slate-50 transition-colors">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.l}</p>
                  <p className="text-xl font-black text-slate-800 tracking-tight">{m.v}<span className="text-[10px] ml-1 text-slate-400">{m.u}</span></p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GaitCycleChart leftData={result.leftCycleY} rightData={result.rightCycleY} title="平均歩行周期波形 (垂直AY)" labels={labels} />
              <div className="bg-indigo-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                <BrainCircuit className="absolute -right-16 -top-16 w-64 h-64 text-indigo-800 opacity-40 group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm"><BrainCircuit className="w-8 h-8 text-indigo-300" /></div>
                    <h3 className="text-2xl font-black tracking-tight">AI Gait Lab Insights</h3>
                  </div>
                  {aiInsight ? (
                    <div className="flex-1 overflow-y-auto pr-4 text-sm leading-relaxed text-indigo-100/90 whitespace-pre-line custom-scrollbar scrollbar-white font-medium italic">{aiInsight}</div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                      <p className="text-indigo-200 text-base max-w-sm mx-auto font-medium leading-relaxed italic opacity-80">
                        "解析データに基づき、被験者の歩行戦略、転倒リスク、左右のバランス異常をAIが臨床的に考察します。"
                      </p>
                      <button onClick={fetchAiInsights} disabled={isLoadingAi} className="group px-10 py-5 bg-white text-indigo-900 rounded-[1.5rem] font-black hover:bg-indigo-50 transition-all shadow-2xl flex items-center gap-4 text-lg">
                        {isLoadingAi ? <Loader2 className="w-6 h-6 animate-spin" /> : <BrainCircuit className="w-6 h-6 group-hover:rotate-12 transition-transform" />} Generate AI Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="py-10 px-8 text-center text-slate-300 text-[11px] font-black uppercase tracking-[0.2em] border-t border-slate-100 bg-white">
        GaitMaster Research & Lab Tool &copy; 2024
      </footer>
    </div>
  );
};

export default App;
