/// <reference types="vite/client" />

interface LiveInstrument {
  symbol: string;
  price: number;
  change: number | null;
  source: string;
  sourceUrl: string;
  observedAt: string;
  freshness: string;
}

interface MarketSnapshot {
  checkedAt: string;
  instruments: LiveInstrument[];
  errors: string[];
  evidenceHash?: string;
}

interface Window {
  sentinel?: {
    platform: string;
    version: string;
    getMarketSnapshot: () => Promise<MarketSnapshot>;
    getMacroSnapshot: () => Promise<MacroSnapshot>;
    getNewsSnapshot: () => Promise<NewsSnapshot>;
    getEvidenceLedgerStatus: () => Promise<{ok:boolean;entries:number;brokenAt:number|null;lastHash:string}>;
    getInstitutionalFactors: () => Promise<InstitutionalFactorSnapshot>;
    listAlerts: () => Promise<{ok:boolean;records:SentinelAlertRecord[]}>;
    upsertAlerts: (alerts:SentinelAlertCandidate[]) => Promise<{ok:boolean;records:SentinelAlertRecord[]}>;
    acknowledgeAlert: (id:string) => Promise<{ok:boolean;record:SentinelAlertRecord|null}>;
    getWatchlists: () => Promise<{ok:boolean;config:WatchlistConfig}>;
    saveWatchlists: (config:WatchlistConfig) => Promise<{ok:boolean;config:WatchlistConfig}>;
    startCryptoFlow: (symbol:string) => Promise<CryptoFlowSnapshot>;
    stopCryptoFlow: (symbol:string) => Promise<{ok:boolean;symbol:string}>;
    getCryptoFlowSnapshot: (symbol:string) => Promise<CryptoFlowSnapshot>;
    onCryptoFlowUpdate: (callback:(snapshot:CryptoFlowSnapshot)=>void) => () => void;
    listAnalysisHistory: () => Promise<{ok:boolean;records:AnalysisHistoryRecord[]}>;
    saveAnalysisHistory: (record:Omit<AnalysisHistoryRecord,'id'|'createdAt'|'schemaVersion'>) => Promise<{ok:boolean;record:AnalysisHistoryRecord}>;
    evaluateAnalysisHistory: () => Promise<{ok:boolean;evaluated:number;skipped:number;records:AnalysisHistoryRecord[]}>;
    getAtomicMt5: () => Promise<AtomicMt5Response>;
    getAtomicTerminals: () => Promise<AtomicTerminalResponse>;
    installAtomicReader: (terminalId:string) => Promise<AtomicInstallResponse>;
    getMt5Status: () => Promise<Record<string, unknown>>;
    getMt5Portfolio: () => Promise<Mt5PortfolioResponse>;
    getMt5Factors: () => Promise<Mt5FactorResponse>;
    getMt5Microstructure: (symbol:string) => Promise<Mt5MicrostructureResponse>;
    searchMt5Symbols: (search: string, limit?: number) => Promise<Record<string, unknown>>;
    getMt5Rates: (symbol: string, timeframe?: string, count?: number) => Promise<Mt5RatesResponse>;
    getMt5MultiRates: (symbol: string, timeframes: string[], count?: number) => Promise<Mt5MultiRatesResponse>;
    scanMt5Market: (limit: number) => Promise<Mt5ScanResponse>;
  };
}

interface MacroIndicator {
  id:string; name:string; value:number; unit:string; period:string; observedAt:string;
  source:string; sourceUrl:string; category:string; frequency:string; interpretation:string;
}
interface MacroEvent { id:string; title:string; currency:string; impact:string; scheduledAt:string; forecast:string|null; previous:string|null; source:string; sourceUrl:string; quality:string }
interface YieldCurve { date:string; y2:number; y5:number; y10:number; y30:number; spread10y2y:number; shape:string; source:string; sourceUrl:string }
interface MacroSnapshot { checkedAt:string; indicators:MacroIndicator[]; events:MacroEvent[]; yieldCurve:YieldCurve|null; errors:string[]; evidenceHash?:string }
interface NewsArticle { id:string; title:string; url:string; publishedAt:string; source:string; credibility:number; summary:string; sourceCountry?:string|null }
interface NewsSnapshot { checkedAt:string; articles:NewsArticle[]; errors:string[]; sources:{name:string;type:string}[]; evidenceHash?:string }
interface InstitutionalFactorSnapshot { checkedAt:string; realYields:{date:string;y5:number;y7:number;y10:number;y20:number;y30:number;source:string}|null; cot:Array<{market:string;date:string;openInterest:number|null;assetManagerNet?:number;leveragedFundsNet?:number;producerNet?:number;managedMoneyNet?:number;source:string}>; cryptoDerivatives:{symbol:string;markPrice:number;indexPrice:number;fundingRate:number;fundingAnnualizedPct:number;nextFundingTime:string;openInterest:number;openInterestValue:number|null;openInterest24hChangePct:number|null;takerBuySellRatio:number|null;longShortAccountRatio:number|null;longAccountPct:number|null;shortAccountPct:number|null;observedAt:string;source:string}|null; errors:string[]; permissions:string; evidenceHash?:string }
interface CryptoFlowSnapshot { ok:boolean;symbol:string;status:string;connected:boolean;startedAt:string;observedAt:string|null;lastTradeAt:string|null;lastLiquidationAt:string|null;lastBookAt:string|null;tradeCount:number;buyNotional:number;sellNotional:number;takerImbalance:number;liquidationCount:number;longLiquidationNotional:number;shortLiquidationNotional:number;liquidationImbalance:number;bid:number|null;ask:number|null;spreadBps:number|null;reconnects:number;source:string;permissions:string }
interface SentinelAlertCandidate { fingerprint:string;category:'MACRO'|'INSTITUTIONAL'|'MICROSTRUCTURE'|'CRYPTO_FLOW'|'DATA';severity:'INFO'|'VIGILAR'|'ALTA'|'CRITICA';symbol:string|null;title:string;details:string;source:string;expiresAt:string|null }
interface SentinelAlertRecord extends SentinelAlertCandidate { id:string;createdAt:string;lastSeenAt:string;acknowledgedAt?:string;count:number;status:'ACTIVE'|'ACKNOWLEDGED';schemaVersion:number }
interface SentinelWatchlist { id:string;name:string;symbols:string[];enabled:boolean }
interface WatchlistConfig { schemaVersion:1;activeListId:string;intervalMinutes:number;lists:SentinelWatchlist[] }
interface Mt5MicrostructureResponse { ok:boolean; requested:string; symbol:string; windowMinutes:number; tickCount:number; midObservations:number; spreadPointsCurrent:number|null; spreadPointsMean:number|null; spreadPointsMax:number|null; tickImbalance:number; tradeFlagImbalance:number|null; buyTradeFlags:number; sellTradeFlags:number; realVolume:number; depthAvailable:boolean; depth:{type:number;price:number;volume:number}[]; buyDepth:number; sellDepth:number; depthImbalance:number|null; quality:'REAL_TRADES_AND_DOM'|'BROKER_TICKS_AND_OPTIONAL_DOM'; observedAt:string; source:string; permissions:string; error?:string; detail?:string }
interface AnalysisHistoryRecord { id:string; createdAt:string; schemaVersion:number; symbol:string; brokerSymbol:string; timeframe:string; decision:string; confidence:number; technicalConfidence:number; alignment:number; eventAction:string; blockingEvent:string|null; regime?:string; strategy?:string; modelId?:string; modelVersion?:string; modelFingerprint?:string; dataCheckedAt?:string; dataQualityScore?:number; dataWarnings?:string[]; evidenceHash?:string; plan:{direction:string|null;trigger:number|null;stop:number|null;tp1:number|null;tp2:number|null}|null; sources:string[]; outcome:null|{status:string;checkedAt:string;activatedAt?:string;resolvedAt?:string;mfe?:number;mae?:number;tp1Reached?:boolean;notes?:string} }

interface AtomicMt5Signal { id:string|null; type:string; symbol:string; timeframe:string; time:string|null; value:number; buyBuffer:number; sellBuffer:number; source:string; raw:string }
interface AtomicMt5Status { symbol:string; timeframe:string; bar:string; buyValue:number; sellValue:number; buyCopied:number; sellCopied:number; updated:string; mode:string; buyBuffer:number; sellBuffer:number }
interface AtomicMt5Response { ok:boolean; active:boolean; statusFileModifiedAt:string|null; signalFileModifiedAt:string|null; status:AtomicMt5Status|null; signals:AtomicMt5Signal[]; latest:AtomicMt5Signal|null; permissions?:string }
interface AtomicTerminal { id:string; root:string; atomicInstalled:boolean; bridgeInstalled:boolean; bridgePath:string }
interface AtomicTerminalResponse { ok:boolean; terminals:AtomicTerminal[] }
interface AtomicInstallResponse { ok:boolean; terminal:AtomicTerminal; restartRequired:boolean; permissions:string }
interface Mt5ScanFrame { close:number; ema20:number; ema50:number; atr:number; slopePct:number; relativeVolume:number; direction:number; bars:number }
interface Mt5ScanCandidate { symbol:string; canonical:string; description:string; path:string; direction:'BUY'|'SELL'|'ESPERAR'; score:number; spreadPoints:number; tickAgeMinutes:number; marketStatus:'ACTIVO'|'DESACTUALIZADO/CERRADO'; h1:Mt5ScanFrame; h4:Mt5ScanFrame; observedAt:string; source:string }
interface Mt5ScanResponse { ok:boolean; scanned:number; qualified:number; candidates:Mt5ScanCandidate[]; method:string; permissions:string; checkedAt:string; error?:string }
interface Mt5Position { ticket:number; symbol:string; canonical:string; side:'BUY'|'SELL'; volume:number; priceOpen:number; priceCurrent:number; stopLoss:number; takeProfit:number; profit:number; swap:number; currencyProfit:string; contractSize:number; tickSize:number; tickValueLoss:number; bid:number|null; ask:number|null; openedAt:string; hasStop:boolean; magic:number }
interface Mt5AccountSnapshot { currency:string; balance:number; equity:number; margin:number; marginFree:number; marginLevel:number; profit:number; leverage:number }
interface Mt5PortfolioResponse { ok:boolean; account:Mt5AccountSnapshot; positions:Mt5Position[]; checkedAt:string; permissions:string; error?:string }
interface Mt5Factor { id:string; symbol:string; description:string; price:number; change1h:number; change24h:number; change5d:number; volatility48h:number; tickAgeMinutes:number; fresh:boolean; source:string }
interface Mt5FactorResponse { ok:boolean; factors:Mt5Factor[]; errors:string[]; checkedAt:string; permissions:string }

interface Mt5Candle {
  time: string; open: number; high: number; low: number; close: number;
  tickVolume: number; spread: number; realVolume: number;
}

interface Mt5RatesResponse {
  ok: boolean; requested?: string; symbol?: string; canonical?: string; timeframe?: string;
  digits?: number; candles?: Mt5Candle[]; source?: string; error?: string; detail?: string;
  specification?: { contractSize:number; tickSize:number; tickValue:number; tickValueProfit:number; tickValueLoss:number; volumeMin:number; volumeMax:number; volumeStep:number; currencyProfit:string; currencyMargin:string };
  tick?: { bid: number; ask: number; last: number; time: string } | null;
}

interface Mt5MultiRatesResponse {
  ok: boolean; requested: string; requestedTimeframes: string[]; availableTimeframes: string[];
  results: Record<string, Mt5RatesResponse>; source: string;
}
