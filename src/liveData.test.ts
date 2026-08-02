import { describe, expect, it } from 'vitest';
import { mergeLiveSnapshot } from './liveData';
import type { Opportunity } from './types';

const base: Opportunity[] = [{
  symbol: 'BTC/USD', name: 'Bitcoin', assetClass: 'Cripto', price: '1.00', change: 0,
  decision: 'ESPERAR', confidence: 50, entryQuality: 50, risk: 'Alto',
  regime: 'Demo', strategy: 'Demo', spark: [1, 2]
}];

describe('mergeLiveSnapshot', () => {
  it('replaces only market fields and preserves the analysis fields', () => {
    const result = mergeLiveSnapshot(base, {
      checkedAt: '2026-08-02T00:00:00.000Z', errors: [], instruments: [{
        symbol: 'BTC/USD', price: 63552.97, change: 0.855, source: 'Binance Spot',
        sourceUrl: 'https://data-api.binance.vision', observedAt: '2026-08-02T00:00:00.000Z',
        freshness: 'tiempo real aproximado'
      }]
    });
    expect(result[0].price).toBe('63,552.97');
    expect(result[0].change).toBe(0.855);
    expect(result[0].decision).toBe('ESPERAR');
    expect(result[0].isLivePrice).toBe(true);
  });
});
