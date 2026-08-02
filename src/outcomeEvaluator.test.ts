import {describe,expect,it} from 'vitest';
// @ts-expect-error CommonJS shared production module
import evaluator from '../shared/outcomeEvaluator.cjs';
const plan={direction:'BUY',trigger:100,stop:98,tp1:103,tp2:105};const t='2026-08-02T12:00:00Z';
describe('outcome evaluator',()=>{it('detecta objetivo posterior a la activación',()=>{const r=evaluator.evaluatePlan(plan,[{time:t,high:101,low:99},{time:'2026-08-02T13:00:00Z',high:106,low:100}],t);expect(r.status).toBe('TP2')});it('marca ambigüedad si stop y objetivo caben en la misma vela',()=>{const r=evaluator.evaluatePlan(plan,[{time:t,high:106,low:97}],t);expect(r.status).toBe('AMBIGUOUS')});it('no inventa activación',()=>expect(evaluator.evaluatePlan(plan,[{time:t,high:99,low:97}],t).status).toBe('NOT_TRIGGERED'))});
