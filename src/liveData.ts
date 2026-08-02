import type { Opportunity } from './types';

export type DataState = 'idle' | 'loading' | 'live' | 'partial' | 'error';

export function mergeLiveSnapshot(
  base: Opportunity[],
  snapshot: MarketSnapshot | null
): Opportunity[] {
  if (!snapshot) return base;
  const liveBySymbol = new Map(snapshot.instruments.map(item => [item.symbol, item]));
  return base.map(item => {
    const live = liveBySymbol.get(item.symbol);
    if (!live) return item;
    return {
      ...item,
      price: formatPrice(live.price, item.symbol),
      change: live.change ?? item.change,
      dataSource: live.source,
      observedAt: live.observedAt,
      isLivePrice: true
    };
  });
}

export function formatPrice(value: number, symbol: string): string {
  const decimals = symbol.includes('EUR/') ? 5 : value >= 1000 ? 2 : 4;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
