import { useState } from "react";
import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { ALL_TIMEFRAMES, analyzeMultiTimeframe } from "./multiTimeframeAnalysis";
import { buildGuardedDecision, type DecisionResult } from "./decisionEngine";
import { rankNews } from "./newsIntelligence";
import { applyPortfolioGate } from "./portfolioGate";
import { evaluateModelGovernance } from "./modelGovernance";
import { assessDatasetQuality } from "./dataQuality";
import { analyzeIntermarket } from "./intermarketEngine";
import { assessInstitutionalFactorRisk } from "./institutionalFactorRisk";
import { analyzeMicrostructure } from "./microstructureEngine";

interface DeepResult { symbol:string; decision:DecisionResult; alignment:number; coverage:number; bias:string }

export default function ScannerWorkspace({ onAnalyze }:{ onAnalyze:(symbol:string)=>void }) {
  const [result,setResult]=useState<Mt5ScanResponse|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [deep,setDeep]=useState<DeepResult[]>([]);
  const [deepLoading,setDeepLoading]=useState(false);
  const scan=async()=>{
    if(!window.sentinel?.scanMt5Market){setError("El escáner requiere la aplicación de escritorio.");return;}
    setLoading(true);setError("");
    try{const next=await window.sentinel.scanMt5Market(300);if(!next.ok)throw new Error(next.error||"Escaneo incompleto");setResult(next)}
    catch(e){setError(e instanceof Error?e.message:"No fue posible escanear MT5.")}
    finally{setLoading(false)}
  };
  const runDeep=async()=>{
    if(!result||!window.sentinel?.getMt5MultiRates||!window.sentinel?.getMacroSnapshot)return;
    const selected=result.candidates.filter(x=>x.marketStatus==='ACTIVO'&&x.direction!=='ESPERAR').slice(0,5);
    if(!selected.length){setError("No hay candidatos con cotización activa. Sentinel no profundizará datos atrasados.");return;}
    setDeepLoading(true);setError("");
    try{
      const [macro,news,portfolio,history,factors,institutional]=await Promise.all([window.sentinel.getMacroSnapshot(),window.sentinel.getNewsSnapshot?.().catch(()=>null),window.sentinel.getMt5Portfolio?.().catch(()=>null),window.sentinel.listAnalysisHistory(),window.sentinel.getMt5Factors?.().catch(()=>null),window.sentinel.getInstitutionalFactors?.().catch(()=>null)]);const completed:DeepResult[]=[];const governance=evaluateModelGovernance(history.records);
      for(const candidate of selected){
        const rates=await window.sentinel.getMt5MultiRates(candidate.symbol,[...ALL_TIMEFRAMES],350);
        if(!rates.ok)continue;
        const quality=assessDatasetQuality(rates.results);if(!quality.valid)continue;
        const technical=analyzeMultiTimeframe(rates.results);
        const intermarket=factors?.ok?analyzeIntermarket(candidate.symbol,factors):undefined;const institutionalRisk=assessInstitutionalFactorRisk(candidate.symbol,institutional);const micro=analyzeMicrostructure(await window.sentinel.getMt5Microstructure?.(candidate.symbol).catch(()=>null)??null);const guarded=buildGuardedDecision(candidate.symbol,technical,macro.events,new Date(),news?rankNews(news):[],intermarket,institutionalRisk,micro);const portfolioProtected=applyPortfolioGate(guarded,portfolio,candidate.symbol,.5).decision;
        const governed=governance.canVote?portfolioProtected:{...portfolioProtected,decision:'ESPERAR' as const,confidence:0,reasons:[...portfolioProtected.reasons,`Modelo ${governance.status.toLowerCase()}: sin voto operativo.`]};
        completed.push({symbol:candidate.symbol,decision:governed,alignment:technical.alignment,coverage:technical.available,bias:technical.bias});
      }
      setDeep(completed.sort((a,b)=>b.decision.confidence-a.decision.confidence));
    }catch(e){setError(e instanceof Error?e.message:"Falló el análisis profundo.")}
    finally{setDeepLoading(false)}
  };
  return <div className="scanner-page">
    <div className="analysis-page-head"><div><p className="eyebrow">PREFILTRO MULTI-ACTIVO</p><h1>Escáner global</h1><p>Clasifica el catálogo de tu bróker en H1/H4 y reserva las 21 temporalidades para el análisis profundo.</p></div><span className="readonly-badge"><ShieldCheck size={15}/> SOLO LECTURA</span></div>
    <div className="card scanner-control"><div><Database size={18}/><span>{result?`${result.scanned} instrumentos revisados · ${result.qualified} con datos suficientes`:"Listo para consultar el catálogo real de MT5"}</span></div><div className="scanner-actions">{result?<button className="text-btn" onClick={runDeep} disabled={deepLoading}>{deepLoading?"Analizando 21 marcos...":"Profundizar mejores 5"}</button>:null}<button className="primary" onClick={scan} disabled={loading}><RefreshCw size={16}/>{loading?" Escaneando...":" Iniciar escaneo"}</button></div></div>
    {error?<div className="connector-message error">{error}</div>:null}
    {result?<div className="card scanner-results"><div className="scanner-head"><span>ACTIVO</span><span>SESGO</span><span>PUNTUACIÓN</span><span>H1 / H4</span><span>ESTADO</span><span></span></div>{result.candidates.map(item=><div className="scanner-row" key={item.symbol}><div><b>{item.symbol}</b><small>{item.description||item.path}</small></div><span className={`decision ${item.direction==='BUY'?'buy':item.direction==='SELL'?'sell':'wait'}`}>{item.direction}</span><b>{item.score}/100</b><span>{item.h1.slopePct.toFixed(2)}% / {item.h4.slopePct.toFixed(2)}%</span><span title={`Último tick hace ${item.tickAgeMinutes} min`}>{item.marketStatus}</span><button className="text-btn" onClick={()=>onAnalyze(item.symbol)}><Activity size={15}/> Profundizar</button></div>)}</div>:null}
    {result?<p className="scanner-note">Este resultado es un prefiltro, no una entrada. Cada candidato debe superar análisis multi-temporal, macro, noticias, Atomic y riesgo.</p>:null}
    {deep.length?<div className="card deep-results"><h2>Análisis profundo protegido</h2>{deep.map(item=><div className="deep-row" key={item.symbol}><div><b>{item.symbol}</b><small>{item.bias} · {item.coverage}/21 marcos</small></div><span className={`decision ${item.decision.decision.startsWith('BUY')?'buy':item.decision.decision.startsWith('SELL')?'sell':'wait'}`}>{item.decision.decision.replaceAll('_',' ')}</span><span>Alineación {item.alignment}%</span><b>{item.decision.confidence}/100</b><button className="text-btn" onClick={()=>onAnalyze(item.symbol)}>Ver análisis</button></div>)}</div>:null}
  </div>
}
