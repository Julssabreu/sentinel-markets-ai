import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { calculatePerformance } from "./performanceStats";
import { evaluateStrategy, STRATEGY_CATALOG } from "./strategyLearning";
import { runWalkForward, type WalkForwardResult } from "./walkForward";
import { runMonteCarlo, stressCosts } from "./monteCarlo";
import { compareStrategies, type CompetitionRow } from "./strategyCompetition";
import { evaluateModelGovernance } from "./modelGovernance";
export default function LaboratoryWorkspace() {
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>([]),
    [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState("EUR/USD"),
    [timeframe, setTimeframe] = useState("H1"),
    [walk, setWalk] = useState<WalkForwardResult | null>(null),
    [competition, setCompetition] = useState<CompetitionRow[]>([]),
    [walkError, setWalkError] = useState("");
  const [ledger,setLedger]=useState<{ok:boolean;entries:number;brokenAt:number|null;lastHash:string}|null>(null);
  const load = async () => {
    if (!window.sentinel?.listAnalysisHistory) return;
    setLoading(true);
    try {
      setRecords((await window.sentinel.listAnalysisHistory()).records);
      if(window.sentinel.getEvidenceLedgerStatus)setLedger(await window.sentinel.getEvidenceLedgerStatus());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const rows = useMemo(
    () =>
      STRATEGY_CATALOG.map((strategy) => {
        const items = records.filter((r) => r.strategy === strategy.id),
          stats = calculatePerformance(items),
          evaluation = evaluateStrategy(stats, strategy.weight);
        return { ...strategy, stats, evaluation };
      }),
    [records],
  );
  const monte = walk
    ? runMonteCarlo(walk.outOfSampleReturns, 3000, 20260802)
    : null;
  const stresses = walk ? stressCosts(walk.outOfSampleReturns) : [];
  const governance = useMemo(() => evaluateModelGovernance(records), [records]);
  const runTest = async () => {
    if (!window.sentinel?.getMt5Rates) return;
    setLoading(true);
    setWalkError("");
    try {
      const response = await window.sentinel.getMt5Rates(
        symbol,
        timeframe,
        3000,
      );
      if (!response.ok || !response.candles)
        throw new Error(response.detail || "No se recibieron velas.");
      setWalk(runWalkForward(response.candles));
      setCompetition(compareStrategies(response.candles));
    } catch (error) {
      setWalkError(
        error instanceof Error
          ? error.message
          : "No se pudo ejecutar walk-forward.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="lab-page">
      <div className="analysis-page-head">
        <div>
          <p className="eyebrow">VALIDACIÓN Y APRENDIZAJE</p>
          <h1>Laboratorio cuantitativo</h1>
          <p>
            Las estrategias compiten con datos posteriores, sin modificar el
            motor operativo.
          </p>
        </div>
        <button
          className="primary macro-refresh"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? "Leyendo..." : "Actualizar evidencia"}
        </button>
      </div>
      <div className="card lab-lock">
        <LockKeyhole />
        <div>
          <b>Promoción manual obligatoria</b>
          <p>
            Ninguna estrategia puede cambiar su peso, entrar en producción ni
            reemplazar otra sin validación y aprobación explícita.
          </p>
        </div>
      </div>
      <section className={`card governance-card ${governance.status.toLowerCase()}`}><div><span>MODELO</span><b>{governance.modelId}</b><small>{governance.version} · {governance.fingerprint}</small></div><div><span>ESTADO OPERATIVO</span><b>{governance.status}</b><small>{governance.canVote?'Voto condicionado habilitado':'Sin voto en consenso'}</small></div><div><span>CALIBRACIÓN BRIER</span><b>{governance.brierScore?.toFixed(3)??'—'}</b><small>{governance.sample}/30 resultados recientes</small></div><div><span>EXPECTATIVA RECIENTE</span><b>{governance.recentAverageR.toFixed(2)}R</b><small>Deriva {governance.drift?.toFixed(2)??'—'}R</small></div><p>{governance.reasons.join(' ')}</p></section>
      {ledger?<section className={`card ledger-card ${ledger.ok?'valid':'invalid'}`}><div><span>BITÁCORA DE EVIDENCIA</span><b>{ledger.ok?'ÍNTEGRA':'ALTERADA'}</b></div><div><span>REGISTROS ENCADENADOS</span><b>{ledger.entries}</b></div><div><span>ÚLTIMO HASH</span><code>{ledger.lastHash.slice(0,20)}…</code></div>{ledger.brokenAt?<p>Cadena rota en el registro {ledger.brokenAt}.</p>:<p>La cadena completa fue verificada.</p>}</section>:null}
      <section className="card walk-card">
        <div className="walk-controls">
          <div>
            <b>Walk-forward · ruptura estructural + ATR</b>
            <small>Optimización cronológica con zona de purga.</small>
          </div>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            {["M15", "M30", "H1", "H4", "D1"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="primary" onClick={runTest} disabled={loading}>
            {loading ? "Calculando..." : "Ejecutar prueba"}
          </button>
        </div>
        {walkError ? <p className="sizing-warning">{walkError}</p> : null}
        {walk ? (
          <>
            <div className="walk-results">
              <div>
                <span>Bloques</span>
                <b>{walk.folds.length}</b>
              </div>
              <div>
                <span>Operaciones OOS</span>
                <b>{walk.outOfSampleTrades}</b>
              </div>
              <div>
                <span>Resultado OOS</span>
                <b>{walk.combined.netR.toFixed(2)}R</b>
              </div>
              <div>
                <span>Expectativa OOS</span>
                <b>{walk.combined.averageR.toFixed(2)}R</b>
              </div>
              <div>
                <span>Drawdown OOS</span>
                <b>{walk.combined.maxDrawdownR.toFixed(2)}R</b>
              </div>
            </div>
            <div className="fold-list">
              {walk.folds.map((fold, index) => (
                <div key={index}>
                  <span>Bloque {index + 1}</span>
                  <b>
                    LB {fold.params.lookback} · ATR {fold.params.atrMultiple}
                  </b>
                  <em>
                    Train {fold.train.averageR.toFixed(2)}R → Test{" "}
                    {fold.test.averageR.toFixed(2)}R
                  </em>
                </div>
              ))}
            </div>
            {walk.warning ? (
              <p className="macro-warning">
                <AlertTriangle />
                {walk.warning}
              </p>
            ) : null}
            {monte?.simulations ? (
              <div className="monte-section">
                <h3>
                  Monte Carlo · {monte.simulations.toLocaleString("es-BO")}{" "}
                  trayectorias
                </h3>
                <div className="monte-metrics">
                  <div>
                    <span>Mediana terminal</span>
                    <b>{monte.medianTerminalR.toFixed(2)}R</b>
                  </div>
                  <div>
                    <span>Percentil 5%</span>
                    <b>{monte.percentile5TerminalR.toFixed(2)}R</b>
                  </div>
                  <div>
                    <span>Drawdown 95%</span>
                    <b>{monte.percentile95DrawdownR.toFixed(2)}R</b>
                  </div>
                  <div>
                    <span>Peor drawdown</span>
                    <b>{monte.worstDrawdownR.toFixed(2)}R</b>
                  </div>
                  <div>
                    <span>Prob. pérdida</span>
                    <b>{monte.probabilityOfLoss.toFixed(1)}%</b>
                  </div>
                  <div>
                    <span>Racha 95%</span>
                    <b>{monte.percentile95LossStreak} pérdidas</b>
                  </div>
                </div>
                <div className="stress-table">
                  <div>
                    <span>Coste por operación</span>
                    <span>Mediana</span>
                    <span>Drawdown 95%</span>
                    <span>Prob. pérdida</span>
                  </div>
                  {stresses.map((row) => (
                    <div key={row.costR}>
                      <b>{row.costR.toFixed(2)}R</b>
                      <span>{row.medianTerminalR.toFixed(2)}R</span>
                      <span>{row.percentile95DrawdownR.toFixed(2)}R</span>
                      <span>{row.probabilityOfLoss.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      {competition.length ? (
        <section className="card competition-card">
          <h2>Competencia fuera de muestra</h2>
          <div className="competition-head">
            <span>ESTRATEGIA</span>
            <span>OPERACIONES</span>
            <span>EXPECTATIVA</span>
            <span>NETO</span>
            <span>DRAWDOWN</span>
            <span>ESTADO</span>
          </div>
          {competition.map((row, index) => (
            <div className="competition-row" key={row.strategy}>
              <b>
                #{index + 1} {row.name}
                <small>{row.strategy}</small>
              </b>
              <span>{row.metrics.trades}</span>
              <span>{row.metrics.averageR.toFixed(2)}R</span>
              <span>{row.metrics.netR.toFixed(2)}R</span>
              <span>{row.metrics.maxDrawdownR.toFixed(2)}R</span>
              <em className={row.eligible ? "eligible" : "rejected"}>
                {row.reason}
              </em>
            </div>
          ))}
          <p className="provider-note">
            La clasificación no modifica pesos operativos. Un candidato elegible
            todavía requiere pruebas de costes, Monte Carlo y aprobación.
          </p>
        </section>
      ) : null}
      <div className="lab-grid">
        {rows.map((row) => (
          <article className="card lab-strategy" key={row.id}>
            <div className="lab-title">
              <Beaker />
              <div>
                <b>{row.name}</b>
                <small>{row.id}</small>
              </div>
              <em className={row.evaluation.verdict.toLowerCase()}>
                {row.evaluation.verdict.replaceAll("_", " ")}
              </em>
            </div>
            <div className="lab-metrics">
              <div>
                <span>Resueltas</span>
                <b>{row.stats.resolved}</b>
              </div>
              <div>
                <span>Expectativa</span>
                <b>{row.stats.averageR.toFixed(2)}R</b>
              </div>
              <div>
                <span>Profit factor</span>
                <b>{row.stats.profitFactor?.toFixed(2) ?? "—"}</b>
              </div>
              <div>
                <span>Drawdown</span>
                <b>{row.stats.maxDrawdownR.toFixed(2)}R</b>
              </div>
            </div>
            <div className="weight-proposal">
              <span>
                Peso actual{" "}
                <b>{Math.round(row.evaluation.currentWeight * 100)}%</b>
              </span>
              <i />
              <span>
                Propuesto{" "}
                <b>{Math.round(row.evaluation.proposedWeight * 100)}%</b>
              </span>
            </div>
            <div className="lab-reasons">
              {row.evaluation.reasons.map((reason) => (
                <p key={reason}>
                  {row.evaluation.verdict === "ELIGIBLE" ? (
                    <CheckCircle2 />
                  ) : (
                    <AlertTriangle />
                  )}
                  {reason}
                </p>
              ))}
            </div>
            <button disabled>Requiere revisión y aprobación</button>
          </article>
        ))}
      </div>
      <p className="analysis-disclaimer">
        Fases futuras: walk-forward, validación purgada, Monte Carlo, costes
        reales y comparación contra benchmark.
      </p>
    </div>
  );
}
