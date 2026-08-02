import { describe, expect, it } from 'vitest';
import { calculateRisk, consensusScore } from './engine';

describe('motor financiero inicial', () => {
  it('calcula riesgo y tamaño sin exceder el capital definido', () => {
    const result = calculateRisk({ balance:1000, riskPct:0.5, entry:100, stop:98, valuePerPoint:1 });
    expect(result.riskAmount).toBe(5); expect(result.stopDistance).toBe(2); expect(result.size).toBe(2.5);
  });
  it('pondera el consenso', () => expect(consensusScore([80,60],[3,1])).toBe(75));
});
