
import { GoogleGenAI } from "@google/genai";
import { GaitMetrics } from "../types";

export const getGaitInsights = async (
  metrics: GaitMetrics, 
  subjectId: string, 
  labels: { sideA: string; sideB: string }
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    以下の歩行解析データを、理学療法や人間工学を学ぶ学生向けに専門的かつ分かりやすく解説してください。
    回答は必ず日本語で行ってください。

    対象者ID: ${subjectId}
    比較対象: ${labels.sideA} vs ${labels.sideB}
    
    【主要指標】
    ・歩行率 (Cadence): ${metrics.cadence.toFixed(1)} steps/min
    ・平均1歩時間 (Step Time): ${metrics.meanStepTime.toFixed(3)} s
    ・平均1ストライド時間 (Stride Time): ${metrics.strideTime.toFixed(3)} s
    ・歩行時間変動係数 (CV): ${metrics.stepTimeCV.toFixed(2)} % (転倒リスクや歩行の安定性の指標)
    
    【運動の強さと揺れ】
    ・合成加速度強度 (RSS RMS): ${metrics.rmsTotal.toFixed(3)} m/s² (歩行の力強さ)
    ・垂直方向の安定性 (RMS Vertical): ${metrics.rmsY.toFixed(3)}
    ・左右の揺れ (RMS Lateral): ${metrics.rmsX.toFixed(3)}
    
    【左右バランス】
    ・時間対称性 (Time Symmetry): ${metrics.symmetryIndex.toFixed(1)} %
    ・垂直動揺対称性 (Power Symmetry): ${metrics.rmsSymmetryY.toFixed(1)} %

    解説のポイント:
    1. 歩行時間変動係数(CV)が示す「歩行の安定性」について、一般的な基準値(3%程度)と比較して解説してください。
    2. ストライド時間と歩行率から、この被験者の歩行戦略（速く歩こうとしているか、慎重かなど）を考察してください。
    3. ${labels.sideA} と ${labels.sideB} の動揺の左右差から、どのような身体的特徴や癖が考えられるか学生に問いかけてください。
    4. 今後の改善に向けた具体的な3つのアドバイスを提示してください。
    
    学生の学習意欲を高める、専門的で教育的なトーンでお願いします。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "解析結果を生成できませんでした。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI解析は現在利用できません。";
  }
};
