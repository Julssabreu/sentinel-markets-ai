import type { Opportunity, Recommendation } from './types';

export const opportunities: Opportunity[] = [
  { symbol:'XAU/USD', name:'Oro al contado', assetClass:'Metal', price:'2,465.30', change:1.14, decision:'ESPERAR', confidence:84, entryQuality:72, risk:'Moderado', regime:'Tendencia alcista volátil', strategy:'Ruptura + retesteo', spark:[41,43,42,46,48,47,52,55,54,59,63,67] },
  { symbol:'EUR/USD', name:'Euro / Dólar', assetClass:'Forex', price:'1.17452', change:-0.31, decision:'SELL', confidence:81, entryQuality:78, risk:'Moderado', regime:'Tendencia bajista', strategy:'Momentum macro', spark:[68,66,67,63,61,59,58,55,53,50,48,46] },
  { symbol:'BTC/USD', name:'Bitcoin', assetClass:'Cripto', price:'64,218.40', change:2.08, decision:'ESPERAR', confidence:62, entryQuality:48, risk:'Alto', regime:'Rango expansivo', strategy:'Ruptura confirmada', spark:[42,48,45,54,51,58,62,55,61,67,64,70] },
  { symbol:'NAS100', name:'Nasdaq 100', assetClass:'Índice', price:'21,482.10', change:0.76, decision:'BUY', confidence:78, entryQuality:74, risk:'Moderado', regime:'Tendencia alcista', strategy:'Seguimiento de tendencia', spark:[45,46,49,48,53,55,57,60,59,64,68,71] },
  { symbol:'AAPL', name:'Apple Inc.', assetClass:'Acción', price:'228.14', change:0.42, decision:'ACUMULAR', confidence:76, entryQuality:69, risk:'Bajo', regime:'Crecimiento estable', strategy:'Calidad + valoración', spark:[51,50,53,55,54,57,59,58,61,63,62,66] },
  { symbol:'CL', name:'Crudo WTI futuro', assetClass:'Futuro', price:'76.84', change:-1.22, decision:'NO ENTRAR', confidence:43, entryQuality:31, risk:'Alto', regime:'Noticias / anomalía', strategy:'Sin estrategia válida', spark:[62,59,61,55,53,57,49,51,46,44,47,41] }
];

export const historySeed: Recommendation[] = [
  { id:'r-001', date:'Hoy · 09:35', symbol:'EUR/USD', decision:'SELL', confidence:81, thesis:'Dólar fuerte, rendimientos al alza y estructura H1 bajista.', status:'Activa' },
  { id:'r-002', date:'Ayer · 15:10', symbol:'XAU/USD', decision:'ESPERAR', confidence:77, thesis:'Dirección favorable, entrada demasiado extendida antes de datos.', status:'Correcta: evitó entrada' },
  { id:'r-003', date:'30 Jul · 11:40', symbol:'AAPL', decision:'ACUMULAR', confidence:74, thesis:'Calidad alta con valoración exigente; compra escalonada.', status:'En seguimiento' }
];

export const marketPulse = [
  ['Apetito por riesgo','Neutral','neutral'], ['Dólar','Fuerte','up'], ['Tasas EE. UU.','Subiendo','up'],
  ['Volatilidad','Elevada','warn'], ['Liquidez','Neutral','neutral'], ['Geopolítica','Riesgo medio','warn']
];
