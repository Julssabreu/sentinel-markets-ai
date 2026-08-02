export type ProviderTier='FREE'|'FREEMIUM'|'PAID'|'LICENSED';
export type ProviderStatus='ACTIVE'|'AVAILABLE'|'REQUIRES_KEY'|'REQUIRES_LICENSE'|'MANUAL_ONLY';
export interface ProviderDefinition { id:string; name:string; tier:ProviderTier; status:ProviderStatus; roles:string[]; autoSpend:boolean; notes:string }

export const PROVIDERS:ProviderDefinition[]=[
 {id:'mt5',name:'MetaTrader 5',tier:'FREE',status:'ACTIVE',roles:['precio operativo','velas','contratos'],autoSpend:false,notes:'Conector local de solo lectura.'},
 {id:'nyfed',name:'Federal Reserve Bank of New York',tier:'FREE',status:'ACTIVE',roles:['tasas','SOFR'],autoSpend:false,notes:'Fuente institucional.'},
 {id:'ecb',name:'Banco Central Europeo',tier:'FREE',status:'ACTIVE',roles:['divisas','macro'],autoSpend:false,notes:'Referencia oficial diaria.'},
 {id:'forexfactory',name:'Forex Factory',tier:'FREE',status:'ACTIVE',roles:['calendario económico'],autoSpend:false,notes:'Exportación semanal; confirmar eventos críticos con la fuente oficial.'},
 {id:'tradingview',name:'TradingView',tier:'FREEMIUM',status:'AVAILABLE',roles:['gráficos','screeners','alertas'],autoSpend:false,notes:'Webhooks o exportaciones autorizadas.'},
 {id:'x',name:'X API',tier:'PAID',status:'REQUIRES_KEY',roles:['sentimiento','rumores','detección temprana'],autoSpend:false,notes:'Pago por uso; requiere presupuesto explícito.'},
 {id:'reuters',name:'Reuters Connect',tier:'LICENSED',status:'REQUIRES_LICENSE',roles:['noticias','geopolítica','confirmación'],autoSpend:false,notes:'API y contenido sujetos a licencia comercial.'},
 {id:'alphasense',name:'AlphaSense',tier:'LICENSED',status:'REQUIRES_LICENSE',roles:['investigación fundamental','documentos','resultados'],autoSpend:false,notes:'Conector API previsto para acciones e inversión.'},
 {id:'investing',name:'Investing.com',tier:'LICENSED',status:'MANUAL_ONLY',roles:['calendario','consulta visual'],autoSpend:false,notes:'Automatización desactivada sin permiso escrito o API autorizada.'}
];

export const activeProviders=()=>PROVIDERS.filter(x=>x.status==='ACTIVE');
export const premiumRoadmap=()=>PROVIDERS.filter(x=>x.tier==='PAID'||x.tier==='LICENSED');
