import {describe,expect,it} from 'vitest';
import {PROVIDERS,premiumRoadmap} from './providerRegistry';
describe('provider registry',()=>{
 it('nunca habilita gasto automático',()=>expect(PROVIDERS.every(x=>!x.autoSpend)).toBe(true));
 it('conserva conectores premium en la hoja de ruta',()=>expect(premiumRoadmap().map(x=>x.id)).toEqual(expect.arrayContaining(['x','reuters','alphasense'])));
});
