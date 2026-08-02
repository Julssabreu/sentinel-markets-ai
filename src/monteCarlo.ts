export interface MonteCarloResult {
  simulations: number;
  tradesPerPath: number;
  medianTerminalR: number;
  percentile5TerminalR: number;
  percentile95DrawdownR: number;
  worstDrawdownR: number;
  probabilityOfLoss: number;
  percentile95LossStreak: number;
}
const quantile = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return (
    s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))] ?? 0
  );
};
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export function runMonteCarlo(
  returns: number[],
  simulations = 2000,
  seed = 12345,
  costR = 0,
): MonteCarloResult {
  if (!returns.length)
    return {
      simulations: 0,
      tradesPerPath: 0,
      medianTerminalR: 0,
      percentile5TerminalR: 0,
      percentile95DrawdownR: 0,
      worstDrawdownR: 0,
      probabilityOfLoss: 0,
      percentile95LossStreak: 0,
    };
  const random = rng(seed),
    terminal: number[] = [],
    drawdowns: number[] = [],
    streaks: number[] = [];
  for (let s = 0; s < simulations; s++) {
    let equity = 0,
      peak = 0,
      dd = 0,
      streak = 0,
      maxStreak = 0;
    for (let i = 0; i < returns.length; i++) {
      const value = returns[Math.floor(random() * returns.length)] - costR;
      equity += value;
      peak = Math.max(peak, equity);
      dd = Math.max(dd, peak - equity);
      if (value < 0) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else streak = 0;
    }
    terminal.push(equity);
    drawdowns.push(dd);
    streaks.push(maxStreak);
  }
  return {
    simulations,
    tradesPerPath: returns.length,
    medianTerminalR: quantile(terminal, 0.5),
    percentile5TerminalR: quantile(terminal, 0.05),
    percentile95DrawdownR: quantile(drawdowns, 0.95),
    worstDrawdownR: Math.max(...drawdowns),
    probabilityOfLoss:
      (100 * terminal.filter((x) => x < 0).length) / simulations,
    percentile95LossStreak: quantile(streaks, 0.95),
  };
}
export function stressCosts(returns: number[], costs = [0, 0.05, 0.1, 0.2]) {
  return costs.map((costR) => ({
    costR,
    ...runMonteCarlo(returns, 1000, 20260802, costR),
  }));
}
