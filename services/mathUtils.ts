
/**
 * 4th order Butterworth Low Pass Filter (implemented as Forward-Backward 2nd order)
 * Provides zero phase shift and -24dB/octave roll-off.
 */
export const lowPassFilter = (data: number[], cutoff: number, fs: number): number[] => {
  const n = data.length;
  if (n < 4) return [...data];

  const f = Math.tan(Math.PI * cutoff / fs);
  const f2 = f * f;
  const sqrt2 = Math.SQRT2;
  
  // 2nd order Butterworth coefficients
  const a0 = f2 / (1 + sqrt2 * f + f2);
  const a1 = 2 * a0;
  const a2 = a0;
  const b1 = 2 * (f2 - 1) / (1 + sqrt2 * f + f2);
  const b2 = (1 - sqrt2 * f + f2) / (1 + sqrt2 * f + f2);

  // First pass (forward)
  const forward = new Array(n).fill(0);
  forward[0] = data[0];
  forward[1] = data[1];
  for (let i = 2; i < n; i++) {
    forward[i] = a0 * data[i] + a1 * data[i - 1] + a2 * data[i - 2] - b1 * forward[i - 1] - b2 * forward[i - 2];
  }

  // Second pass (backward) to make it 4th order zero-phase
  const output = new Array(n).fill(0);
  output[n - 1] = forward[n - 1];
  output[n - 2] = forward[n - 2];
  for (let i = n - 3; i >= 0; i--) {
    output[i] = a0 * forward[i] + a1 * forward[i + 1] + a2 * forward[i + 2] - b1 * output[i + 1] - b2 * output[i + 2];
  }

  return output;
};

/**
 * Peak detection using local statistics
 */
export const findPeaks = (data: number[], minHeight: number, minDistance: number): number[] => {
  const peaks: number[] = [];
  for (let i = 1; i < data.length - 1; i++) {
    // Peak condition: local maxima and above threshold
    if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > minHeight) {
      if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
        peaks.push(i);
      } else {
        // If peaks are too close, keep the one with higher magnitude
        const lastIdx = peaks[peaks.length - 1];
        if (data[i] > data[lastIdx]) {
          peaks[peaks.length - 1] = i;
        }
      }
    }
  }
  return peaks;
};

export const calculateRMS = (data: number[]): number => {
  if (data.length === 0) return 0;
  const squareSum = data.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(squareSum / data.length);
};

export const calculateStd = (data: number[]): number => {
  if (data.length === 0) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
};

export const lerp = (x0: number, y0: number, x1: number, y1: number, x: number): number => {
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
};

export const normalizeGaitCycle = (data: number[], points: number): number[] => {
  const resampled = new Array(points);
  for (let i = 0; i < points; i++) {
    const targetIdx = (i / (points - 1)) * (data.length - 1);
    const x0 = Math.floor(targetIdx);
    const x1 = Math.min(x0 + 1, data.length - 1);
    if (x0 === x1) {
      resampled[i] = data[x0];
    } else {
      resampled[i] = lerp(x0, data[x0], x1, data[x1], targetIdx);
    }
  }
  return resampled;
};
