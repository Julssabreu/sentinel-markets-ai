export interface RiskInput { balance:number; riskPct:number; entry:number; stop:number; valuePerPoint:number }
export function calculateRisk(input: RiskInput) {
  const riskAmount = input.balance * input.riskPct / 100;
  const stopDistance = Math.abs(input.entry - input.stop);
  const size = stopDistance > 0 && input.valuePerPoint > 0 ? riskAmount / (stopDistance * input.valuePerPoint) : 0;
  return { riskAmount, stopDistance, size };
}

export function consensusScore(scores: number[], weights?: number[]) {
  if (!scores.length) return 0;
  const safeWeights = weights?.length === scores.length ? weights : scores.map(() => 1);
  const total = safeWeights.reduce((a,b) => a+b, 0);
  return total ? Math.round(scores.reduce((sum, score, index) => sum + score * safeWeights[index], 0) / total) : 0;
}
