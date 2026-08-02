import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Activity, Bell, BookOpen, Bot, BriefcaseBusiness, Calculator, ChevronRight, CircleHelp, Clock3, Database, Eye, Gauge, Globe2, History, LayoutDashboard, Menu, MessageSquareText, Newspaper, Search, Settings, ShieldCheck, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { historySeed, marketPulse, opportunities } from './data';
import { calculateRisk } from './engine';
import { mergeLiveSnapshot, type DataState } from './liveData';
import AnalysisWorkspace from './AnalysisWorkspace';
import MacroWorkspace from './MacroWorkspace';
import HistoryWorkspace from './HistoryWorkspace';
import LaboratoryWorkspace from './LaboratoryWorkspace';
import ScannerWorkspace from './ScannerWorkspace';
import JulssbotChat from './JulssbotChat';
import PortfolioWorkspace from './PortfolioWorkspace';
import AlertWorkspace from './AlertWorkspace';
import WatchlistWorkspace from './WatchlistWorkspace';
import { useAlertMonitor } from './useAlertMonitor';

const nav = [
  ['Centro global', LayoutDashboard], ['Oportunidades', Target], ['Analizar activo', Activity], ['Estrategias', Gauge],
  ['Riesgo', Calculator], ['Cartera', BriefcaseBusiness], ['Noticias y macro', Newspaper], ['Julssbot AI', MessageSquareText],
  ['Alertas', Bell], ['Listas de vigilancia', Eye], ['Historial', History], ['Laboratorio', BookOpen]
] as const;

const decisionClass: Record<string,string> = { BUY:'buy', SELL:'sell', ESPERAR:'wait', ACUMULAR:'accumulate', 'NO ENTRAR':'avoid' };

function MiniChart({ values, positive=true }:{values:number[]; positive?:boolean}) {
  const data=values.map((v,i)=>({i,v}));
  return <ResponsiveContainer width="100%" height={50}><AreaChart data={data}><defs><linearGradient id={positive?'g':'r'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={positive?'#2de2a6':'#ff667d'} stopOpacity={.45}/><stop offset="1" stopColor={positive?'#2de2a6':'#ff667d'} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="v" stroke={positive?'#2de2a6':'#ff667d'} fill={`url(#${positive?'g':'r'})`} strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer>
}

function Ring({value,label}:{value:number;label:string}) { return <div className="ring-wrap"><div className="ring" style={{'--score':`${value*3.6}deg`} as React.CSSProperties}><span>{value}</span></div><small>{label}</small></div> }

export default function App(){
  const [active,setActive]=useState('Centro global'); const [selectedSymbol,setSelectedSymbol]=useState(opportunities[0].symbol);
  const [query,setQuery]=useState(''); const [sidebar,setSidebar]=useState(true); const [chatOpen,setChatOpen]=useState(false);
  const [snapshot,setSnapshot]=useState<MarketSnapshot|null>(null); const [dataState,setDataState]=useState<DataState>('idle');
  const [dataMessage,setDataMessage]=useState('Fuentes reales pendientes');
  const savedRisk=useMemo(()=>{try{return JSON.parse(localStorage.getItem('sentinel-risk')||'{}')}catch{return {}}},[]);
  const [balance,setBalance]=useState(Number(savedRisk.balance)||1000); const [riskPct,setRiskPct]=useState(Number(savedRisk.riskPct)||.5); const [entry,setEntry]=useState(Number(savedRisk.entry)||100); const [stop,setStop]=useState(Number(savedRisk.stop)||98);
  const risk=useMemo(()=>calculateRisk({balance,riskPct,entry,stop,valuePerPoint:1}),[balance,riskPct,entry,stop]);
  const currentOpportunities=useMemo(()=>mergeLiveSnapshot(opportunities,snapshot),[snapshot]);
  const alertMonitor=useAlertMonitor(selectedSymbol);
  const selected=currentOpportunities.find(o=>o.symbol===selectedSymbol)??currentOpportunities[0];
  const filtered=currentOpportunities.filter(o=>(o.symbol+' '+o.name+' '+o.assetClass).toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>localStorage.setItem('sentinel-risk',JSON.stringify({balance,riskPct,entry,stop})),[balance,riskPct,entry,stop]);
  const refreshMarketData=async()=>{
    if(!window.sentinel?.getMarketSnapshot){setDataState('error');setDataMessage('Conector disponible en la aplicacion instalada');return;}
    setDataState('loading'); setDataMessage('Consultando fuentes...');
    try{
      const next=await window.sentinel.getMarketSnapshot(); setSnapshot(next);
      setDataState(next.instruments.length===0?'error':next.errors.length?'partial':'live');
      setDataMessage(next.instruments.length===0?'No se recibieron datos':`${next.instruments.length} precios verificados${next.errors.length?' - conexion parcial':''}`);
    }catch(error){setDataState('error');setDataMessage(error instanceof Error?error.message:'Error al consultar fuentes');}
  };
  useEffect(()=>{void refreshMarketData()},[]);

  return <div className={`app ${sidebar?'':'collapsed'}`}>
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Globe2 size={22}/></div><div><b>SENTINEL</b><span>MARKETS AI</span></div></div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={active===label?'active':''} onClick={()=>setActive(label)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot"><div className={`status-dot ${dataState}`}/><div><b>Modo investigación 0.3.1</b><span>{dataMessage}</span></div><Settings size={17}/></div>
    </aside>
    <main>
      <header><button className="icon-btn" onClick={()=>setSidebar(!sidebar)}><Menu size={20}/></button><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar activo, mercado o símbolo..."/><kbd>Ctrl K</kbd></div><div className="header-actions"><span className={`demo-pill ${dataState}`}><Database size={14}/> {dataState==='live'?'DATOS REALES':dataState==='partial'?'DATOS MIXTOS':dataState==='loading'?'ACTUALIZANDO':'MODO HÍBRIDO'}</span><button className={`icon-btn alert-bell ${alertMonitor.criticalCount?'critical':''}`} title={`${alertMonitor.activeCount} alertas activas`} onClick={()=>setActive('Alertas')}><Bell size={19}/>{alertMonitor.activeCount?<strong>{alertMonitor.activeCount>99?'99+':alertMonitor.activeCount}</strong>:null}</button><div className="avatar">JA</div></div></header>
      <section className="content">
        {active==='Analizar activo'?<AnalysisWorkspace initialSymbol={selectedSymbol}/>:active==='Oportunidades'?<ScannerWorkspace onAnalyze={value=>{setSelectedSymbol(value);setActive('Analizar activo')}}/>:active==='Julssbot AI'?<JulssbotChat symbol={selectedSymbol}/>:active==='Cartera'?<PortfolioWorkspace/>:active==='Noticias y macro'?<MacroWorkspace/>:active==='Alertas'?<AlertWorkspace/>:active==='Listas de vigilancia'?<WatchlistWorkspace/>:active==='Historial'?<HistoryWorkspace/>:active==='Laboratorio'?<LaboratoryWorkspace/>:<>
        <div className="welcome"><div><p className="eyebrow">CENTRO DE MANDO GLOBAL</p><h1>Buenos días, Julio.</h1><p>Precios reales iniciales; señales y análisis aún demostrativos y separados.</p></div><div className="last-update"><Clock3 size={16}/><span>Última consulta<br/><b>{snapshot?new Date(snapshot.checkedAt).toLocaleTimeString('es-BO'):dataMessage}</b></span><button onClick={refreshMarketData} disabled={dataState==='loading'}>{dataState==='loading'?'Actualizando...':'Actualizar datos'}</button></div></div>
        <div className="pulse-grid">{marketPulse.map(([k,v,c])=><div className="pulse" key={k}><span>{k}</span><b className={c}>{v}</b><div className={`pulse-line ${c}`}/></div>)}</div>
        <div className="section-title"><div><h2>Radar de oportunidades</h2><p>Clasificación multi-activo según consenso, entrada y riesgo.</p></div><button className="text-btn" onClick={()=>setActive('Oportunidades')}>Ver escáner completo <ChevronRight size={16}/></button></div>
        <div className="workspace-grid"><div className="opportunity-card card"><div className="table-head"><span>ACTIVO</span><span>SEÑAL</span><span>CONFIANZA</span><span>RIESGO</span><span>MOVIMIENTO</span></div>{filtered.map(o=><button key={o.symbol} className={`op-row ${selected.symbol===o.symbol?'selected':''}`} onClick={()=>setSelectedSymbol(o.symbol)}><div className="asset"><div className={`asset-icon ${o.assetClass.toLowerCase().replace('í','i')}`}>{o.symbol.slice(0,2)}</div><div><b>{o.symbol}</b><span>{o.name} · {o.assetClass}{o.isLivePrice?' · PRECIO REAL':''}</span></div></div><span className={`decision ${decisionClass[o.decision]}`}>{o.decision}</span><div className="confidence"><b>{o.confidence}</b><div><i style={{width:`${o.confidence}%`}}/></div></div><span className={`risk ${o.risk.toLowerCase()}`}>{o.risk}</span><div className="move"><MiniChart values={o.spark} positive={o.change>=0}/><b className={o.change>=0?'positive':'negative'}>{o.change>0?'+':''}{o.change}%</b></div></button>)}</div>
          <aside className="analysis-card card"><div className="analysis-top"><div><span className="eyebrow">ANÁLISIS PROFUNDO</span><h2>{selected.symbol}</h2><p>{selected.name} · {selected.assetClass}</p></div><span className={`decision large ${decisionClass[selected.decision]}`}>{selected.decision}</span></div><div className="score-row"><Ring value={selected.confidence} label="Dirección"/><Ring value={selected.entryQuality} label="Entrada"/><Ring value={selected.risk==='Bajo'?82:selected.risk==='Moderado'?64:38} label="Seguridad"/></div><div className="thesis"><Sparkles size={18}/><div><b>Lectura de Julssbot (demostrativa)</b><p>{selected.decision==='NO ENTRAR'?'No existe una ventaja clara. La incertidumbre y el riesgo superan la calidad de la oportunidad.':`El régimen de ${selected.regime.toLowerCase()} favorece ${selected.strategy.toLowerCase()}, pero la entrada debe respetar la confirmación y la invalidación.`}</p></div></div><div className="analysis-points"><div><span>Régimen demo</span><b>{selected.regime}</b></div><div><span>Estrategia demo</span><b>{selected.strategy}</b></div><div><span>{selected.isLivePrice?'Precio real':'Precio demo'}</span><b>{selected.price}</b><small>{selected.dataSource??'Muestra local'}</small></div><div><span>Riesgo demo</span><b>{selected.risk}</b></div></div><button className="primary" onClick={()=>setActive('Analizar activo')}>Abrir análisis completo <ChevronRight size={17}/></button></aside></div>
        <div className="lower-grid"><div className="card strategy-card"><div className="card-heading"><div><ShieldCheck/><span><b>Plan operativo</b><small>Condiciones antes de actuar</small></span></div><span className="quality">CALIDAD {selected.entryQuality}/100</span></div><div className="plan-grid"><div><span>Entrada</span><b>Solo con confirmación</b><small>No anticipar ruptura</small></div><div><span>Invalidación</span><b>Definida por estructura</b><small>Stop obligatorio</small></div><div><span>Objetivos</span><b>TP1 · TP2 · trailing</b><small>R:R mínimo 1:2</small></div><div><span>Caducidad</span><b>Según temporalidad</b><small>Reanalizar si expira</small></div></div></div>
          <div className="card risk-card"><div className="card-heading"><div><Calculator/><span><b>Calculadora de riesgo</b><small>Tamaño orientativo</small></span></div></div><div className="risk-inputs"><label>Balance<input type="number" value={balance} onChange={e=>setBalance(+e.target.value)}/></label><label>Riesgo %<input type="number" step="0.1" value={riskPct} onChange={e=>setRiskPct(+e.target.value)}/></label><label>Entrada<input type="number" value={entry} onChange={e=>setEntry(+e.target.value)}/></label><label>Stop<input type="number" value={stop} onChange={e=>setStop(+e.target.value)}/></label></div><div className="risk-result"><span>Capital en riesgo <b>${risk.riskAmount.toFixed(2)}</b></span><span>Tamaño teórico <b>{risk.size.toFixed(2)}</b></span></div></div>
        </div>
        <div className="card history-card"><div className="section-title compact"><div><h2>Historial de recomendaciones</h2><p>Trazabilidad y aprendizaje del sistema.</p></div><button className="text-btn">Ver historial <ChevronRight size={16}/></button></div>{historySeed.map(h=><div className="history-row" key={h.id}><span>{h.date}</span><b>{h.symbol}</b><span className={`decision ${decisionClass[h.decision]}`}>{h.decision}</span><p>{h.thesis}</p><em>{h.status}</em></div>)}</div>
        </>}
      </section>
    </main>
    <button className="ai-fab" onClick={()=>setChatOpen(true)}><Bot size={22}/><span>Analizar con Julssbot</span></button>
    {chatOpen&&<div className="chat-panel"><JulssbotChat symbol={selectedSymbol} compact onClose={()=>setChatOpen(false)}/></div>}
  </div>
}
