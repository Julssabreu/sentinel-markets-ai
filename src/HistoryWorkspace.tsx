import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Database,
  History,
  RefreshCw,
} from "lucide-react";
import { calculatePerformance, groupPerformance } from "./performanceStats";
export default function HistoryWorkspace() {
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    if (!window.sentinel?.listAnalysisHistory) {
      setError("El historial requiere la aplicación instalada.");
      return;
    }
    setLoading(true);
    try {
      const r = await window.sentinel.listAnalysisHistory();
      setRecords(r.records);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No fue posible leer el historial.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const evaluate = async () => {
    if (!window.sentinel?.evaluateAnalysisHistory) return;
    setLoading(true);
    try {
      const result = await window.sentinel.evaluateAnalysisHistory();
      setRecords(result.records);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No fue posible evaluar los resultados.",
      );
    } finally {
      setLoading(false);
    }
  };
  const stats = calculatePerformance(records);
  const groups = groupPerformance(records, "symbol");
  return (
    <div className="history-page">
      <div className="analysis-page-head">
        <div>
          <p className="eyebrow">TRAZABILIDAD LOCAL</p>
          <h1>Historial de análisis</h1>
          <p>
            Registro verificable de lo que Sentinel conocía al emitir cada
            veredicto.
          </p>
        </div>
        <div className="history-actions">
          <button
            className="primary macro-refresh"
            onClick={evaluate}
            disabled={loading}
          >
            <History size={15} />
            Evaluar pendientes
          </button>
          <button
            className="primary macro-refresh"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} />
            {loading ? "Leyendo..." : "Actualizar"}
          </button>
        </div>
      </div>
      {error ? (
        <div className="connector-message error">
          <AlertTriangle size={15} />
          {error}
        </div>
      ) : null}
      <div className="history-stats">
        <div className="card">
          <span>Análisis guardados</span>
          <b>{records.length}</b>
        </div>
        <div className="card">
          <span>Bloqueados por eventos</span>
          <b>
            {records.filter((x) => x.decision === "NO_OPERAR_EVENTO").length}
          </b>
        </div>
        <div className="card">
          <span>Con plan calculado</span>
          <b>{records.filter((x) => x.plan?.trigger).length}</b>
        </div>
        <div className="card">
          <span>Evaluados posteriormente</span>
          <b>{records.filter((x) => x.outcome).length}</b>
        </div>
      </div>
      <div className="card performance-summary">
        <div>
          <span>RESULTADOS RESUELTOS</span>
          <b>{stats.resolved}</b>
        </div>
        <div>
          <span>WIN RATE</span>
          <b>{stats.winRate}%</b>
        </div>
        <div>
          <span>EXPECTATIVA</span>
          <b>{stats.averageR.toFixed(2)}R</b>
        </div>
        <div>
          <span>PROFIT FACTOR</span>
          <b>{stats.profitFactor?.toFixed(2) ?? "—"}</b>
        </div>
        <div>
          <span>RESULTADO NETO</span>
          <b>{stats.netR.toFixed(2)}R</b>
        </div>
        <div>
          <span>DRAWDOWN</span>
          <b>{stats.maxDrawdownR.toFixed(2)}R</b>
        </div>
        {stats.sampleWarning ? (
          <p>
            <AlertTriangle size={12} />
            {stats.sampleWarning}
          </p>
        ) : null}
      </div>
      {groups.length ? (
        <div className="card group-performance">
          <h2>Desempeño por activo</h2>
          <div className="group-head">
            <span>ACTIVO</span>
            <span>RESUELTAS</span>
            <span>WIN RATE</span>
            <span>NETO</span>
            <span>PROFIT FACTOR</span>
            <span>DRAWDOWN</span>
          </div>
          {groups.map((g) => (
            <div className="group-row" key={g.name}>
              <b>{g.name}</b>
              <span>{g.resolved}</span>
              <span>{g.winRate}%</span>
              <span>{g.netR.toFixed(2)}R</span>
              <span>{g.profitFactor?.toFixed(2) ?? "—"}</span>
              <span>{g.maxDrawdownR.toFixed(2)}R</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="card audit-table">
        <div className="audit-head audit-seven">
          <span>FECHA</span>
          <span>ACTIVO</span>
          <span>VEREDICTO</span>
          <span>CONFIANZA</span>
          <span>PLAN</span>
          <span>FUENTES</span>
          <span>RESULTADO</span>
        </div>
        {records.map((r) => (
          <div className="audit-row audit-seven" key={r.id}>
            <time>
              <Clock3 />
              {new Date(r.createdAt).toLocaleString("es-BO")}
            </time>
            <b>
              {r.symbol}
              <small>
                {r.brokerSymbol} · {r.timeframe}
              </small>
            </b>
            <strong className={r.decision.toLowerCase()}>
              {r.decision.replaceAll("_", " ")}
            </strong>
            <span>
              {r.confidence}/100<small>Técnica {r.technicalConfidence}</small>
            </span>
            <span>
              {r.plan?.trigger
                ? `${r.plan.direction} ${r.plan.trigger}`
                : "Sin entrada"}
              <small>{r.plan?.stop ? `Stop ${r.plan.stop}` : ""}</small>
            </span>
            <span>
              <Database />
              {r.sources.length}
              <small>{r.eventAction.replaceAll("_", " ")}</small>
            </span>
            <strong className={(r.outcome?.status ?? "pending").toLowerCase()}>
              {r.outcome?.status?.replaceAll("_", " ") ?? "PENDIENTE"}
              <small>
                {r.outcome?.mfe != null
                  ? `MFE ${r.outcome.mfe.toFixed(5)} · MAE ${r.outcome.mae?.toFixed(5)}`
                  : ""}
              </small>
            </strong>
          </div>
        ))}
        {!records.length && !loading ? (
          <div className="empty-history">
            <History />
            <b>Todavía no existen análisis guardados.</b>
            <span>Ejecuta un análisis real para crear el primer registro.</span>
          </div>
        ) : null}
      </div>
      <p className="analysis-disclaimer">
        Los registros son locales y no contienen credenciales ni instrucciones
        de ejecución.
      </p>
    </div>
  );
}
