const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const { createHash } = require('crypto');
const { evaluatePlan } = require('../shared/outcomeEvaluator.cjs');
const atomicParser = require('../shared/atomicMt5Parser.cjs');

const REQUEST_TIMEOUT_MS = 10000;
const cryptoFlowMonitors = new Map();
let ledgerQueue=Promise.resolve();
function stableJson(value){if(Array.isArray(value))return`[${value.map(stableJson).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;return JSON.stringify(value)}
function ledgerPath(){return path.join(app.getPath('userData'),'evidence-ledger.jsonl')}
async function appendLedgerNow(kind,payload){let previousHash='GENESIS';try{const content=await fs.readFile(ledgerPath(),'utf8'),lines=content.trim().split(/\r?\n/);if(lines.length&&lines[0])previousHash=JSON.parse(lines.at(-1)).hash}catch{}const createdAt=new Date().toISOString(),payloadHash=createHash('sha256').update(stableJson(payload)).digest('hex'),hash=createHash('sha256').update(`${previousHash}|${kind}|${createdAt}|${payloadHash}`).digest('hex'),entry={schemaVersion:1,kind,createdAt,previousHash,payloadHash,hash,payload};await fs.mkdir(path.dirname(ledgerPath()),{recursive:true});await fs.appendFile(ledgerPath(),JSON.stringify(entry)+'\n','utf8');return{hash,payloadHash,createdAt}}
function appendLedger(kind,payload){const task=ledgerQueue.then(()=>appendLedgerNow(kind,payload));ledgerQueue=task.catch(()=>{});return task}
async function verifyLedger(){try{const lines=(await fs.readFile(ledgerPath(),'utf8')).split(/\r?\n/).filter(Boolean);let previous='GENESIS';for(let i=0;i<lines.length;i++){const entry=JSON.parse(lines[i]),payloadHash=createHash('sha256').update(stableJson(entry.payload)).digest('hex'),hash=createHash('sha256').update(`${previous}|${entry.kind}|${entry.createdAt}|${payloadHash}`).digest('hex');if(entry.previousHash!==previous||entry.payloadHash!==payloadHash||entry.hash!==hash)return{ok:false,entries:lines.length,brokenAt:i+1,lastHash:previous};previous=entry.hash}return{ok:true,entries:lines.length,brokenAt:null,lastHash:previous}}catch(error){if(error.code==='ENOENT')return{ok:true,entries:0,brokenAt:null,lastHash:'GENESIS'};throw error}}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Sentinel-Markets-AI/0.2.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent':'Sentinel-Markets-AI/0.2.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

async function loadMarketSnapshot() {
  const checkedAt = new Date().toISOString();
  const results = await Promise.allSettled([
    fetchJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT'),
    fetchJson('https://api.frankfurter.dev/v2/rate/EUR/USD?providers=ECB')
  ]);

  const instruments = [];
  const errors = [];
  if (results[0].status === 'fulfilled') {
    const item = results[0].value;
    instruments.push({
      symbol: 'BTC/USD', price: Number(item.lastPrice), change: Number(item.priceChangePercent),
      source: 'Binance Spot', sourceUrl: 'https://data-api.binance.vision',
      observedAt: new Date(Number(item.closeTime)).toISOString(), freshness: 'tiempo real aproximado'
    });
  } else errors.push(`Binance: ${results[0].reason?.message || 'sin respuesta'}`);

  if (results[1].status === 'fulfilled') {
    const item = results[1].value;
    instruments.push({
      symbol: 'EUR/USD', price: Number(item.rate), change: null,
      source: 'BCE via Frankfurter', sourceUrl: 'https://frankfurter.dev/providers/ecb/',
      observedAt: `${item.date}T16:00:00.000Z`, freshness: 'referencia diaria; no apta para entrada intradia'
    });
  } else errors.push(`BCE/Frankfurter: ${results[1].reason?.message || 'sin respuesta'}`);

  return { checkedAt, instruments, errors };
}

ipcMain.handle('market:snapshot', async () => {const value=await loadMarketSnapshot();const evidence=await appendLedger('MARKET_SNAPSHOT',value);return{...value,evidenceHash:evidence.hash}});

async function loadMacroSnapshot() {
  const checkedAt = new Date().toISOString();
  const results = await Promise.allSettled([
    fetchJson('https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json'),
    fetchJson('https://api.frankfurter.dev/v2/rate/EUR/USD?providers=ECB'),
    fetchJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
    fetchJson('https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0'),
    fetchJson('https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000'),
    fetchJson('https://api.bls.gov/publicAPI/v2/timeseries/data/CES0000000001'),
    fetchText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${new Date().getUTCFullYear()}`)
  ]);
  const indicators = [];
  const events = [];
  const errors = [];
  if (results[0].status === 'fulfilled') {
    const row = results[0].value?.refRates?.[0];
    if (row) indicators.push({ id:'SOFR', name:'SOFR', value:Number(row.percentRate), unit:'%', period:row.effectiveDate,
      observedAt:`${row.effectiveDate}T12:00:00.000Z`, source:'Federal Reserve Bank of New York',
      sourceUrl:'https://markets.newyorkfed.org/read?productCode=50&eventCodes=525&startDt=&endDt=&sort=postDt:-1,eventCode:1&format=csv',
      category:'Tasas', frequency:'diaria', interpretation:'Coste de financiación garantizada en dólares.' });
    else errors.push('New York Fed: respuesta sin SOFR.');
  } else errors.push(`New York Fed: ${results[0].reason?.message || 'sin respuesta'}`);
  if (results[1].status === 'fulfilled') {
    const row = results[1].value;
    indicators.push({ id:'ECB_EURUSD', name:'EUR/USD de referencia BCE', value:Number(row.rate), unit:'USD por EUR', period:row.date,
      observedAt:`${row.date}T16:00:00.000Z`, source:'BCE vía Frankfurter', sourceUrl:'https://frankfurter.dev/providers/ecb/',
      category:'Divisas', frequency:'diaria', interpretation:'Referencia oficial diaria; no es una cotización operativa.' });
  } else errors.push(`BCE: ${results[1].reason?.message || 'sin respuesta'}`);
  if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) {
    const now = Date.now();
    for (const row of results[2].value) {
      const timestamp = new Date(row.date).getTime();
      if (Number.isFinite(timestamp) && timestamp >= now - 86400000) events.push({
        id:`FF-${row.country}-${row.date}-${row.title}`, title:row.title, currency:row.country,
        impact:row.impact, scheduledAt:new Date(timestamp).toISOString(), forecast:row.forecast || null,
        previous:row.previous || null, source:'Forex Factory', sourceUrl:'https://www.forexfactory.com/calendar',
        quality:'secondary-calendar'
      });
    }
    events.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
  } else errors.push(`Forex Factory: ${results[2].reason?.message || 'respuesta inválida'}`);
  const blsDefinitions = [
    { index:3, id:'US_CPI', name:'IPC estadounidense ajustado', unit:'índice', category:'Inflación', interpretation:'Nivel general de precios para consumidores urbanos.', series:'CUSR0000SA0' },
    { index:4, id:'US_UNEMPLOYMENT', name:'Desempleo de Estados Unidos', unit:'%', category:'Empleo', interpretation:'Tasa de desempleo civil ajustada estacionalmente.', series:'LNS14000000' },
    { index:5, id:'US_PAYROLLS', name:'Nóminas no agrícolas', unit:'miles', category:'Empleo', interpretation:'Nivel de empleo no agrícola; analizar cambios mensuales, no el nivel aislado.', series:'CES0000000001' }
  ];
  for (const definition of blsDefinitions) {
    const result = results[definition.index];
    if (result?.status === 'fulfilled') {
      const point = result.value?.Results?.series?.[0]?.data?.[0];
      if (point) indicators.push({ id:definition.id, name:definition.name, value:Number(point.value), unit:definition.unit,
        period:`${point.periodName} ${point.year}`, observedAt:`${point.year}-${String(new Date(`${point.periodName} 1, ${point.year}`).getMonth()+1).padStart(2,'0')}-01T12:00:00.000Z`,
        source:'U.S. Bureau of Labor Statistics', sourceUrl:`https://data.bls.gov/timeseries/${definition.series}`,
        category:definition.category, frequency:'mensual', interpretation:definition.interpretation });
      else errors.push(`BLS ${definition.series}: respuesta sin datos.`);
    } else errors.push(`BLS ${definition.series}: ${result?.reason?.message || 'sin respuesta'}`);
  }
  let yieldCurve = null;
  if (results[6]?.status === 'fulfilled') {
    const entries = results[6].value.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const latest = entries.at(-1) || '';
    const value = key => Number((latest.match(new RegExp(`<d:${key}[^>]*>([^<]+)<\\/d:${key}>`)) || [])[1]);
    const date = (latest.match(/<d:NEW_DATE[^>]*>([^<]+)<\/d:NEW_DATE>/) || [])[1];
    const points = { y2:value('BC_2YEAR'), y5:value('BC_5YEAR'), y10:value('BC_10YEAR'), y30:value('BC_30YEAR') };
    if (date && Object.values(points).every(Number.isFinite)) yieldCurve = { date, ...points,
      spread10y2y:Number((points.y10-points.y2).toFixed(2)), shape:points.y10-points.y2<0?'INVERTIDA':points.y10-points.y2<0.35?'PLANA':'NORMAL',
      source:'U.S. Department of the Treasury', sourceUrl:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve' };
    else errors.push('Tesoro de EE. UU.: no fue posible interpretar la curva.');
  } else errors.push(`Tesoro de EE. UU.: ${results[6]?.reason?.message || 'sin respuesta'}`);
  return { checkedAt, indicators, events:events.slice(0,80), yieldCurve, errors };
}

ipcMain.handle('macro:snapshot', async () => {const value=await loadMacroSnapshot();const evidence=await appendLedger('MACRO_SNAPSHOT',value);return{...value,evidenceHash:evidence.hash}});

function decodeXml(value='') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function parseRss(xml, source, credibility) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi)||[]).slice(0,40).flatMap((item,index)=>{
    const pick=tag=>decodeXml((item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'');
    const title=pick('title'),url=pick('link'),publishedAt=pick('pubDate')||pick('dc:date');
    return title&&url?[{id:`${source}-${index}-${title}`,title,url,publishedAt:new Date(publishedAt||Date.now()).toISOString(),source,credibility,summary:pick('description')}]:[];
  });
}
async function loadNewsSnapshot() {
  const checkedAt=new Date().toISOString();
  const gdeltUrl='https://api.gdeltproject.org/api/v2/doc/doc?query=(markets%20OR%20economy%20OR%20bitcoin%20OR%20central%20bank)&mode=artlist&maxrecords=50&format=json&sort=datedesc';
  const results=await Promise.allSettled([
    fetchText('https://www.federalreserve.gov/feeds/press_monetary.xml'),
    fetchText('https://www.ecb.europa.eu/rss/press.html'),
    fetchJson(gdeltUrl)
  ]);
  let articles=[];const errors=[];
  if(results[0].status==='fulfilled')articles.push(...parseRss(results[0].value,'Federal Reserve',100));else errors.push(`Reserva Federal: ${results[0].reason?.message||'sin respuesta'}`);
  if(results[1].status==='fulfilled')articles.push(...parseRss(results[1].value,'Banco Central Europeo',100));else errors.push(`BCE: ${results[1].reason?.message||'sin respuesta'}`);
  if(results[2].status==='fulfilled')articles.push(...(results[2].value?.articles||[]).map((item,index)=>({id:`GDELT-${index}-${item.title}`,title:item.title,url:item.url,publishedAt:item.seendate?`${item.seendate.slice(0,4)}-${item.seendate.slice(4,6)}-${item.seendate.slice(6,8)}T${item.seendate.slice(9,11)}:${item.seendate.slice(11,13)}:${item.seendate.slice(13,15)}Z`:checkedAt,source:item.domain||'GDELT',credibility:65,summary:'',sourceCountry:item.sourcecountry||null})));else errors.push(`GDELT: ${results[2].reason?.message||'sin respuesta'}`);
  const seen=new Set();articles=articles.filter(item=>{const key=item.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,100);
  return {checkedAt,articles,errors,sources:[{name:'Federal Reserve',type:'oficial'},{name:'Banco Central Europeo',type:'oficial'},{name:'GDELT',type:'agregador'}]};
}
ipcMain.handle('news:snapshot', async()=>{const value=await loadNewsSnapshot();const evidence=await appendLedger('NEWS_SNAPSHOT',value);return{...value,evidenceHash:evidence.hash}});
ipcMain.handle('data:ledger-status', async()=>verifyLedger());

function numberAt(parts,index){const value=Number(String(parts[index]??'').replace(/[^0-9.-]/g,''));return Number.isFinite(value)?value:null}
function parseCot(text,kind){return text.split(/\r?\n/).filter(Boolean).flatMap(line=>{const p=line.split(','),market=String(p[0]||'').replaceAll('"','').trim(),date=String(p[2]||'').trim();if(p.length<24||!market)return[];if(kind==='FINANCIAL')return[{market,date,openInterest:numberAt(p,7),assetManagerNet:(numberAt(p,11)??0)-(numberAt(p,12)??0),leveragedFundsNet:(numberAt(p,14)??0)-(numberAt(p,15)??0),source:'CFTC Traders in Financial Futures'}];return[{market,date,openInterest:numberAt(p,7),producerNet:(numberAt(p,8)??0)-(numberAt(p,9)??0),managedMoneyNet:(numberAt(p,13)??0)-(numberAt(p,14)??0),source:'CFTC Disaggregated COT'}]})}
async function loadInstitutionalFactors(){const year=new Date().getUTCFullYear(),results=await Promise.allSettled([
 fetchText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_real_yield_curve&field_tdr_date_value=${year}`),
 fetchText('https://www.cftc.gov/dea/newcot/FinFutWk.txt'),fetchText('https://www.cftc.gov/dea/newcot/f_disagg.txt'),
 fetchJson('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),fetchJson('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
 fetchJson('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=24'),
 fetchJson('https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=5m&limit=30'),
 fetchJson('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=30')]);const errors=[];let realYields=null,cot=[],cryptoDerivatives=null;
 if(results[0].status==='fulfilled'){const entries=results[0].value.match(/<entry>[\s\S]*?<\/entry>/g)||[],latest=entries.at(-1)||'',pick=k=>Number((latest.match(new RegExp(`<d:${k}[^>]*>([^<]+)<\\/d:${k}>`))||[])[1]),date=(latest.match(/<d:NEW_DATE[^>]*>([^<]+)<\/d:NEW_DATE>/)||[])[1];if(date)realYields={date,y5:pick('TC_5YEAR'),y7:pick('TC_7YEAR'),y10:pick('TC_10YEAR'),y20:pick('TC_20YEAR'),y30:pick('TC_30YEAR'),source:'U.S. Department of the Treasury'};else errors.push('Tesoro real: respuesta no interpretable.')}else errors.push(`Tesoro real: ${results[0].reason?.message||'sin respuesta'}`);
 if(results[1].status==='fulfilled')cot.push(...parseCot(results[1].value,'FINANCIAL').filter(x=>/EURO FX|BRITISH POUND|JAPANESE YEN|BITCOIN|NASDAQ|S&P 500|U\.S\. DOLLAR INDEX/i.test(x.market)));else errors.push(`CFTC financiero: ${results[1].reason?.message||'sin respuesta'}`);
 if(results[2].status==='fulfilled')cot.push(...parseCot(results[2].value,'DISAGGREGATED').filter(x=>/GOLD|SILVER|CRUDE OIL|NATURAL GAS|COPPER/i.test(x.market)));else errors.push(`CFTC materias primas: ${results[2].reason?.message||'sin respuesta'}`);
 if(results[3].status==='fulfilled'&&results[4].status==='fulfilled'){const premium=results[3].value,open=results[4].value,hist=results[5].status==='fulfilled'?results[5].value:[],taker=results[6].status==='fulfilled'?results[6].value:[],accounts=results[7].status==='fulfilled'?results[7].value:[],first=hist[0],last=hist.at(-1),takerLast=taker.at(-1),accountLast=accounts.at(-1);cryptoDerivatives={symbol:'BTCUSDT',markPrice:Number(premium.markPrice),indexPrice:Number(premium.indexPrice),fundingRate:Number(premium.lastFundingRate),fundingAnnualizedPct:Number(premium.lastFundingRate)*3*365*100,nextFundingTime:new Date(Number(premium.nextFundingTime)).toISOString(),openInterest:Number(open.openInterest),openInterestValue:last?Number(last.sumOpenInterestValue):null,openInterest24hChangePct:first&&last?((Number(last.sumOpenInterest)-Number(first.sumOpenInterest))/Number(first.sumOpenInterest))*100:null,takerBuySellRatio:takerLast?Number(takerLast.buySellRatio):null,longShortAccountRatio:accountLast?Number(accountLast.longShortRatio):null,longAccountPct:accountLast?Number(accountLast.longAccount)*100:null,shortAccountPct:accountLast?Number(accountLast.shortAccount)*100:null,observedAt:new Date(Number(open.time)).toISOString(),source:'Binance USDⓈ-M Futures'};}else errors.push('Binance derivados: datos principales incompletos.');
 return{checkedAt:new Date().toISOString(),realYields,cot,cryptoDerivatives,errors,permissions:'public-read-only'} }
ipcMain.handle('institutional:factors',async()=>{const value=await loadInstitutionalFactors();const evidence=await appendLedger('INSTITUTIONAL_FACTORS',value);return{...value,evidenceHash:evidence.hash}});

function normalizeBinanceFuturesSymbol(value) {
  const compact=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (!/^[A-Z0-9]{2,16}$/.test(compact)) throw new Error('Símbolo cripto inválido.');
  return compact.endsWith('USDT') ? compact : `${compact.replace(/USD$/,'')}USDT`;
}
function emptyFlowSnapshot(symbol,status='CONNECTING') { return {ok:true,symbol,status,connected:false,startedAt:new Date().toISOString(),observedAt:null,lastTradeAt:null,lastLiquidationAt:null,lastBookAt:null,tradeCount:0,buyNotional:0,sellNotional:0,takerImbalance:0,liquidationCount:0,longLiquidationNotional:0,shortLiquidationNotional:0,liquidationImbalance:0,bid:null,ask:null,spreadBps:null,reconnects:0,source:'Binance USDⓈ-M Futures WebSocket',permissions:'public-read-only'}; }
function flowSnapshot(monitor) {
  const s=monitor.snapshot,total=s.buyNotional+s.sellNotional,liq=s.longLiquidationNotional+s.shortLiquidationNotional;
  return {...s,takerImbalance:total?(s.buyNotional-s.sellNotional)/total:0,liquidationImbalance:liq?(s.shortLiquidationNotional-s.longLiquidationNotional)/liq:0};
}
function broadcastFlow(monitor) { const value=flowSnapshot(monitor); for(const win of BrowserWindow.getAllWindows()) win.webContents.send('crypto:flow-update',value); }
function scheduleFlowReconnect(monitor) {
  if(monitor.closed)return; monitor.snapshot.connected=false;monitor.snapshot.status='RECONNECTING';monitor.snapshot.reconnects+=1;broadcastFlow(monitor);
  clearTimeout(monitor.reconnectTimer);monitor.reconnectTimer=setTimeout(()=>connectCryptoFlow(monitor),Math.min(30000,1000*2**Math.min(monitor.snapshot.reconnects,5)));
}
function connectCryptoFlow(monitor) {
  const lower=monitor.symbol.toLowerCase(),url=`wss://fstream.binance.com/stream?streams=${lower}@aggTrade/${lower}@forceOrder/${lower}@bookTicker`;
  try {
    const socket=new WebSocket(url);monitor.socket=socket;
    socket.addEventListener('open',()=>{monitor.snapshot.connected=true;monitor.snapshot.status='LIVE';monitor.snapshot.reconnects=0;broadcastFlow(monitor)});
    socket.addEventListener('message',event=>{try{const envelope=JSON.parse(String(event.data)),stream=envelope.stream||'',data=envelope.data||{};
      const eventAt=new Date(Number(data.E)||Date.now()).toISOString();
      if(stream.endsWith('@aggTrade')){const notional=Number(data.p)*Number(data.q);monitor.snapshot.lastTradeAt=eventAt;if(Number.isFinite(notional)){monitor.snapshot.tradeCount+=1;if(data.m)monitor.snapshot.sellNotional+=notional;else monitor.snapshot.buyNotional+=notional}}
      else if(stream.endsWith('@forceOrder')){const order=data.o||{},notional=Number(order.ap||order.p)*Number(order.z||order.q);monitor.snapshot.lastLiquidationAt=eventAt;if(Number.isFinite(notional)){monitor.snapshot.liquidationCount+=1;if(order.S==='SELL')monitor.snapshot.longLiquidationNotional+=notional;else monitor.snapshot.shortLiquidationNotional+=notional}}
      else if(stream.endsWith('@bookTicker')){const bid=Number(data.b),ask=Number(data.a);monitor.snapshot.lastBookAt=eventAt;if(Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0){monitor.snapshot.bid=bid;monitor.snapshot.ask=ask;monitor.snapshot.spreadBps=((ask-bid)/((ask+bid)/2))*10000}}
      monitor.snapshot.observedAt=eventAt;const now=Date.now();if(now-monitor.lastBroadcast>=1000){monitor.lastBroadcast=now;broadcastFlow(monitor)}
    }catch{}});
    socket.addEventListener('close',()=>scheduleFlowReconnect(monitor));socket.addEventListener('error',()=>{try{socket.close()}catch{}});
  } catch { scheduleFlowReconnect(monitor); }
}
function stopCryptoFlow(symbol) { const monitor=cryptoFlowMonitors.get(symbol);if(!monitor)return;monitor.closed=true;clearTimeout(monitor.reconnectTimer);try{monitor.socket?.close()}catch{}cryptoFlowMonitors.delete(symbol); }
ipcMain.handle('crypto:flow-start',(_event,value)=>{const symbol=normalizeBinanceFuturesSymbol(value);let monitor=cryptoFlowMonitors.get(symbol);if(!monitor){monitor={symbol,snapshot:emptyFlowSnapshot(symbol),socket:null,reconnectTimer:null,lastBroadcast:0,closed:false};cryptoFlowMonitors.set(symbol,monitor);connectCryptoFlow(monitor)}return flowSnapshot(monitor)});
ipcMain.handle('crypto:flow-stop',(_event,value)=>{const symbol=normalizeBinanceFuturesSymbol(value);stopCryptoFlow(symbol);return{ok:true,symbol}});
ipcMain.handle('crypto:flow-snapshot',(_event,value)=>{const symbol=normalizeBinanceFuturesSymbol(value),monitor=cryptoFlowMonitors.get(symbol);return monitor?flowSnapshot(monitor):{...emptyFlowSnapshot(symbol,'STOPPED'),ok:false}});

function historyPath() { return path.join(app.getPath('userData'), 'analysis-history.json'); }
function alertsPath() { return path.join(app.getPath('userData'), 'sentinel-alerts.json'); }
async function readAlerts(){try{const value=JSON.parse(await fs.readFile(alertsPath(),'utf8'));return Array.isArray(value)?value:[]}catch(error){if(error.code==='ENOENT')return[];throw error}}
async function writeAlerts(records){const target=alertsPath(),temporary=`${target}.tmp`;await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(temporary,JSON.stringify(records.slice(0,2000),null,2),'utf8');await fs.rename(temporary,target)}
ipcMain.handle('alerts:list',async()=>({ok:true,records:await readAlerts()}));
ipcMain.handle('alerts:upsert',async(_event,incoming)=>{if(!Array.isArray(incoming))throw new Error('Alertas inválidas.');const records=await readAlerts(),now=new Date().toISOString();for(const candidate of incoming){if(!candidate?.fingerprint||!candidate?.title)continue;const existing=records.find(x=>x.fingerprint===candidate.fingerprint&&x.status==='ACTIVE');if(existing){existing.lastSeenAt=now;existing.count=(existing.count||1)+1;existing.details=candidate.details;existing.severity=candidate.severity}else records.unshift({...candidate,id:crypto.randomUUID(),createdAt:now,lastSeenAt:now,count:1,status:'ACTIVE',schemaVersion:1})}await writeAlerts(records);return{ok:true,records}});
ipcMain.handle('alerts:acknowledge',async(_event,id)=>{const records=await readAlerts(),item=records.find(x=>x.id===id);if(item){item.status='ACKNOWLEDGED';item.acknowledgedAt=new Date().toISOString();await writeAlerts(records)}return{ok:Boolean(item),record:item||null}});
async function readHistory() {
  try { const value = JSON.parse(await fs.readFile(historyPath(), 'utf8')); return Array.isArray(value) ? value : []; }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function writeHistory(records) {
  const target = historyPath(), temporary = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive:true });
  await fs.writeFile(temporary, JSON.stringify(records.slice(0, 5000), null, 2), 'utf8');
  await fs.rename(temporary, target);
}
ipcMain.handle('history:list', async () => ({ ok:true, records:await readHistory() }));
ipcMain.handle('history:append', async (_event, record) => {
  if (!record || typeof record.symbol !== 'string' || typeof record.decision !== 'string') throw new Error('Registro de análisis inválido.');
  const records = await readHistory();
  const saved = { ...record, id:crypto.randomUUID(), createdAt:new Date().toISOString(), schemaVersion:1 };
  const evidence=await appendLedger('ANALYSIS_RECOMMENDATION',saved);saved.evidenceHash=evidence.hash;
  records.unshift(saved); await writeHistory(records); return { ok:true, record:saved };
});
ipcMain.handle('history:evaluate', async () => {
  const records = await readHistory(); let evaluated = 0, skipped = 0;
  for (const record of records) {
    if (!record.plan || ['TP2','STOP','AMBIGUOUS'].includes(record.outcome?.status)) { skipped++; continue; }
    try {
      const response = await runMt5Bridge('rates', ['--symbol', String(record.brokerSymbol || record.symbol), '--timeframe', String(record.timeframe || 'H1'), '--count', '2000']);
      if (!response.ok || !response.candles) { skipped++; continue; }
      record.outcome = evaluatePlan(record.plan, response.candles, record.createdAt); evaluated++;
    } catch { skipped++; }
  }
  await writeHistory(records); return { ok:true, evaluated, skipped, records };
});
ipcMain.handle('atomic:mt5', async () => {
  const common = path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal', 'Common', 'Files', 'Sentinel');
  const statusPath = path.join(common, 'AtomicMT5_Status.txt'), signalsPath = path.join(common, 'AtomicMT5_Signals.txt');
  let status=null,signals=[],statusStat=null,signalStat=null;
  try { statusStat=await fs.stat(statusPath); status=atomicParser.parseStatus(await fs.readFile(statusPath,'utf8')); } catch {}
  try { signalStat=await fs.stat(signalsPath); signals=atomicParser.parseSignals(await fs.readFile(signalsPath,'utf8')); } catch {}
  const active=Boolean(statusStat&&Date.now()-statusStat.mtimeMs<15000);
  return {ok:Boolean(status||signals.length),active,statusFileModifiedAt:statusStat?.mtime.toISOString()||null,signalFileModifiedAt:signalStat?.mtime.toISOString()||null,status,signals:signals.slice(-500),latest:signals.at(-1)||null,permissions:'read-only'};
});

function atomicBridgeSourcePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'integrations', 'mt5', 'SentinelAtomicReader.ex5')
    : path.join(__dirname, '..', 'integrations', 'mt5', 'SentinelAtomicReader.ex5');
}

async function inspectAtomicTerminals() {
  const terminalRoot = path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal');
  const terminals = [];
  let entries = [];
  try { entries = await fs.readdir(terminalRoot, { withFileTypes:true }); } catch { return terminals; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[A-F0-9]{20,}$/i.test(entry.name)) continue;
    const root = path.join(terminalRoot, entry.name);
    const atomicPath = path.join(root, 'MQL5', 'Indicators', 'Market', 'Atomic Analyst MT5.ex5');
    const bridgePath = path.join(root, 'MQL5', 'Experts', 'Sentinel', 'SentinelAtomicReader.ex5');
    const [atomicInstalled, bridgeInstalled] = await Promise.all([
      fs.access(atomicPath).then(()=>true).catch(()=>false),
      fs.access(bridgePath).then(()=>true).catch(()=>false)
    ]);
    if (atomicInstalled || bridgeInstalled) terminals.push({ id:entry.name, root, atomicInstalled, bridgeInstalled, bridgePath });
  }
  return terminals;
}

ipcMain.handle('atomic:terminals', async () => ({ ok:true, terminals:await inspectAtomicTerminals() }));
ipcMain.handle('atomic:install-reader', async (_event, terminalId) => {
  if (!/^[A-F0-9]{20,}$/i.test(String(terminalId || ''))) throw new Error('Terminal MT5 inválido.');
  const terminals = await inspectAtomicTerminals();
  const terminal = terminals.find(item => item.id === terminalId && item.atomicInstalled);
  if (!terminal) throw new Error('Atomic Analyst MT5 no fue encontrado en ese terminal.');
  await fs.mkdir(path.dirname(terminal.bridgePath), { recursive:true });
  await fs.copyFile(atomicBridgeSourcePath(), terminal.bridgePath);
  return { ok:true, terminal:{ ...terminal, bridgeInstalled:true }, restartRequired:true, permissions:'read-only' };
});

function mt5BridgePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'services', 'mt5_bridge.py')
    : path.join(__dirname, '..', 'services', 'mt5_bridge.py');
}

function runMt5Bridge(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [mt5BridgePath(), command, ...args], {
      windowsHide: true,
      timeout: 20000
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      try {
        const payload = JSON.parse(stdout.trim());
        resolve({ ...payload, bridgeExitCode: code });
      } catch {
        reject(new Error(stderr.trim() || stdout.trim() || `MT5 bridge exited with ${code}`));
      }
    });
  });
}

ipcMain.handle('mt5:status', () => runMt5Bridge('status'));
ipcMain.handle('mt5:portfolio', () => runMt5Bridge('portfolio'));
ipcMain.handle('mt5:factors', () => runMt5Bridge('factors'));
ipcMain.handle('mt5:microstructure', (_event, symbol) => runMt5Bridge('microstructure', ['--symbol', String(symbol)]));
ipcMain.handle('mt5:catalog', (_event, search = '', limit = 100) =>
  runMt5Bridge('catalog', ['--search', String(search), '--limit', String(limit)]));
ipcMain.handle('mt5:rates', (_event, symbol, timeframe = 'H1', count = 300) =>
  runMt5Bridge('rates', ['--symbol', String(symbol), '--timeframe', String(timeframe), '--count', String(count)]));
ipcMain.handle('mt5:multi-rates', (_event, symbol, timeframes, count = 300) =>
  runMt5Bridge('multi_rates', ['--symbol', String(symbol), '--timeframes', timeframes.join(','), '--count', String(count)]));
ipcMain.handle('mt5:scan', (_event, limit = 300) =>
  runMt5Bridge('scan', ['--limit', String(limit)]));

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#07101d',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const useLocalBuild = process.env.SENTINEL_LOCAL_BUILD === '1';
  if (!app.isPackaged && !useLocalBuild) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('before-quit',()=>{for(const symbol of [...cryptoFlowMonitors.keys()])stopCryptoFlow(symbol)});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
