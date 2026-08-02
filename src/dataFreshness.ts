export interface FreshnessAssessment { fresh:boolean; ageMinutes:number; reason:string }
export function assessTickFreshness(time:string|undefined|null,now=new Date(),maximumMinutes=30):FreshnessAssessment{
  const timestamp=time?new Date(time).getTime():Number.NaN;
  if(!Number.isFinite(timestamp))return{fresh:false,ageMinutes:Infinity,reason:"MT5 no entregó una hora válida para la cotización."};
  const ageMinutes=Math.max(0,(now.getTime()-timestamp)/60000);
  return{fresh:ageMinutes<=maximumMinutes,ageMinutes,reason:ageMinutes<=maximumMinutes?`Cotización actualizada hace ${ageMinutes.toFixed(1)} min.`:`Cotización atrasada ${ageMinutes.toFixed(0)} min; mercado posiblemente cerrado.`};
}
