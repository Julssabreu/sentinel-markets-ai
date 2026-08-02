function evaluatePlan(plan, candles, createdAt) {
  if (!plan || !plan.trigger || !plan.stop) return { status:'NO_PLAN', checkedAt:new Date().toISOString() };
  const relevant = candles.filter(c => new Date(c.time).getTime() >= new Date(createdAt).getTime());
  let activatedAt = null, mfe = 0, mae = 0, tp1Reached = false;
  const buy = plan.direction === 'BUY';
  for (const candle of relevant) {
    if (!activatedAt) {
      const triggered = buy ? candle.high >= plan.trigger : candle.low <= plan.trigger;
      if (!triggered) continue;
      activatedAt = candle.time;
    }
    const favorable = buy ? candle.high - plan.trigger : plan.trigger - candle.low;
    const adverse = buy ? plan.trigger - candle.low : candle.high - plan.trigger;
    mfe = Math.max(mfe, favorable); mae = Math.max(mae, adverse);
    const hitStop = buy ? candle.low <= plan.stop : candle.high >= plan.stop;
    const hitTp2 = plan.tp2 ? (buy ? candle.high >= plan.tp2 : candle.low <= plan.tp2) : false;
    const hitTp1 = plan.tp1 ? (buy ? candle.high >= plan.tp1 : candle.low <= plan.tp1) : false;
    if (hitStop && (hitTp1 || hitTp2)) return { status:'AMBIGUOUS', checkedAt:new Date().toISOString(), activatedAt, resolvedAt:candle.time, mfe, mae, notes:'Stop y objetivo aparecen dentro de la misma vela; se desconoce el orden.' };
    if (hitStop) return { status:'STOP', checkedAt:new Date().toISOString(), activatedAt, resolvedAt:candle.time, mfe, mae, tp1Reached };
    if (hitTp2) return { status:'TP2', checkedAt:new Date().toISOString(), activatedAt, resolvedAt:candle.time, mfe, mae, tp1Reached:true };
    if (hitTp1) tp1Reached = true;
  }
  return { status:activatedAt ? (tp1Reached?'OPEN_TP1_REACHED':'OPEN') : 'NOT_TRIGGERED', checkedAt:new Date().toISOString(), activatedAt, mfe, mae, tp1Reached };
}
module.exports = { evaluatePlan };
