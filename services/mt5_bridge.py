"""Read-only MetaTrader 5 bridge for Sentinel Markets AI.

The bridge never receives credentials and intentionally exposes no order methods.
It connects to the locally running terminal selected by MetaTrader 5.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from typing import Any

import MetaTrader5 as mt5


TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M2": mt5.TIMEFRAME_M2,
    "M3": mt5.TIMEFRAME_M3,
    "M4": mt5.TIMEFRAME_M4,
    "M5": mt5.TIMEFRAME_M5,
    "M6": mt5.TIMEFRAME_M6,
    "M10": mt5.TIMEFRAME_M10,
    "M12": mt5.TIMEFRAME_M12,
    "M15": mt5.TIMEFRAME_M15,
    "M20": mt5.TIMEFRAME_M20,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H2": mt5.TIMEFRAME_H2,
    "H3": mt5.TIMEFRAME_H3,
    "H4": mt5.TIMEFRAME_H4,
    "H6": mt5.TIMEFRAME_H6,
    "H8": mt5.TIMEFRAME_H8,
    "H12": mt5.TIMEFRAME_H12,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}


def emit(payload: dict[str, Any], exit_code: int = 0) -> None:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    raise SystemExit(exit_code)


def canonical_symbol(value: str) -> str:
    """Return a broker-independent comparison key."""
    aliases = {
        "XBT": "BTC",
        "GOLD": "XAUUSD",
        "SILVER": "XAGUSD",
        "USTEC": "NAS100",
        "US100": "NAS100",
        "NDX": "NAS100",
        "DE40": "GER40",
    }
    cleaned = re.sub(r"[^A-Z0-9]", "", value.upper())
    for source, target in aliases.items():
        cleaned = cleaned.replace(source, target)
    return cleaned


def symbol_score(requested: str, broker_symbol: str) -> tuple[int, int, str]:
    wanted = canonical_symbol(requested)
    candidate = canonical_symbol(broker_symbol)
    if candidate == wanted:
        return (0, len(broker_symbol), broker_symbol)
    if candidate.startswith(wanted):
        return (1, len(candidate) - len(wanted), broker_symbol)
    if wanted in candidate:
        return (2, len(candidate) - len(wanted), broker_symbol)
    return (99, len(candidate), broker_symbol)


def connect() -> None:
    if not mt5.initialize():
        code, message = mt5.last_error()
        emit({"ok": False, "error": "MT5_INIT_FAILED", "detail": message, "code": code}, 2)


def sanitized_status() -> dict[str, Any]:
    terminal = mt5.terminal_info()
    account = mt5.account_info()
    if terminal is None:
        code, message = mt5.last_error()
        return {"ok": False, "error": "TERMINAL_INFO_UNAVAILABLE", "detail": message, "code": code}
    return {
        "ok": True,
        "connected": bool(terminal.connected),
        "tradeAllowed": bool(terminal.trade_allowed),
        "terminal": {
            "name": terminal.name,
            "company": terminal.company,
            "path": terminal.path,
            "dataPath": terminal.data_path,
            "build": terminal.build,
        },
        "account": None if account is None else {
            "server": account.server,
            "company": account.company,
            "currency": account.currency,
            "leverage": account.leverage,
            "tradeMode": account.trade_mode,
        },
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "permissions": "read-only",
    }


def portfolio() -> dict[str, Any]:
    account = mt5.account_info()
    positions = mt5.positions_get()
    if account is None:
        code, message = mt5.last_error()
        return {"ok": False, "error": "ACCOUNT_INFO_UNAVAILABLE", "detail": message, "code": code}
    if positions is None:
        positions = []
    rows = []
    for item in positions:
        info = mt5.symbol_info(item.symbol)
        tick = mt5.symbol_info_tick(item.symbol)
        rows.append({
            "ticket": int(item.ticket), "symbol": item.symbol, "canonical": canonical_symbol(item.symbol),
            "side": "BUY" if item.type == mt5.POSITION_TYPE_BUY else "SELL", "volume": float(item.volume),
            "priceOpen": float(item.price_open), "priceCurrent": float(item.price_current),
            "stopLoss": float(item.sl), "takeProfit": float(item.tp), "profit": float(item.profit),
            "swap": float(item.swap), "currencyProfit": info.currency_profit if info else account.currency,
            "contractSize": float(info.trade_contract_size) if info else 0.0,
            "tickSize": float(info.trade_tick_size) if info else 0.0,
            "tickValueLoss": float(info.trade_tick_value_loss) if info else 0.0,
            "bid": float(tick.bid) if tick else None, "ask": float(tick.ask) if tick else None,
            "openedAt": datetime.fromtimestamp(item.time, timezone.utc).isoformat(),
            "hasStop": bool(item.sl and item.sl > 0), "magic": int(item.magic)
        })
    return {"ok": True, "account": {"currency": account.currency, "balance": float(account.balance),
            "equity": float(account.equity), "margin": float(account.margin), "marginFree": float(account.margin_free),
            "marginLevel": float(account.margin_level), "profit": float(account.profit), "leverage": int(account.leverage)},
            "positions": rows, "checkedAt": datetime.now(timezone.utc).isoformat(), "permissions": "read-only"}


def find_symbol(requested: str) -> Any:
    symbols = mt5.symbols_get()
    if symbols is None:
        return None
    ranked = sorted((symbol_score(requested, item.name), item) for item in symbols)
    if not ranked or ranked[0][0][0] >= 99:
        return None
    return ranked[0][1]


def catalog(search: str, limit: int) -> dict[str, Any]:
    symbols = mt5.symbols_get()
    if symbols is None:
        code, message = mt5.last_error()
        return {"ok": False, "error": "SYMBOLS_UNAVAILABLE", "detail": message, "code": code}
    query = search.casefold().strip()
    selected = [item for item in symbols if not query or query in f"{item.name} {item.description} {item.path}".casefold()]
    return {
        "ok": True,
        "total": len(symbols),
        "returned": min(len(selected), limit),
        "symbols": [{
            "symbol": item.name,
            "canonical": canonical_symbol(item.name),
            "description": item.description,
            "path": item.path,
            "currencyBase": item.currency_base,
            "currencyProfit": item.currency_profit,
            "digits": item.digits,
            "contractSize": item.trade_contract_size,
            "volumeMin": item.volume_min,
            "volumeMax": item.volume_max,
            "volumeStep": item.volume_step,
            "visible": bool(item.visible),
        } for item in selected[:limit]],
    }


def rates(symbol: str, timeframe: str, count: int) -> dict[str, Any]:
    matched = find_symbol(symbol)
    if matched is None:
        return {"ok": False, "error": "SYMBOL_NOT_FOUND", "requested": symbol}
    mt5.symbol_select(matched.name, True)
    frame = TIMEFRAMES.get(timeframe.upper())
    if frame is None:
        return {"ok": False, "error": "INVALID_TIMEFRAME", "supported": list(TIMEFRAMES)}
    data = mt5.copy_rates_from_pos(matched.name, frame, 0, count)
    tick = mt5.symbol_info_tick(matched.name)
    if data is None:
        code, message = mt5.last_error()
        return {"ok": False, "error": "RATES_UNAVAILABLE", "detail": message, "code": code}
    candles = [{
        "time": datetime.fromtimestamp(int(row["time"]), timezone.utc).isoformat(),
        "open": float(row["open"]), "high": float(row["high"]),
        "low": float(row["low"]), "close": float(row["close"]),
        "tickVolume": int(row["tick_volume"]), "spread": int(row["spread"]),
        "realVolume": int(row["real_volume"]),
    } for row in data]
    return {
        "ok": True,
        "requested": symbol,
        "symbol": matched.name,
        "canonical": canonical_symbol(symbol),
        "timeframe": timeframe.upper(),
        "digits": matched.digits,
        "specification": {
            "contractSize": matched.trade_contract_size,
            "tickSize": matched.trade_tick_size,
            "tickValue": matched.trade_tick_value,
            "tickValueProfit": matched.trade_tick_value_profit,
            "tickValueLoss": matched.trade_tick_value_loss,
            "volumeMin": matched.volume_min,
            "volumeMax": matched.volume_max,
            "volumeStep": matched.volume_step,
            "currencyProfit": matched.currency_profit,
            "currencyMargin": matched.currency_margin,
        },
        "tick": None if tick is None else {
            "bid": tick.bid, "ask": tick.ask, "last": tick.last,
            "time": datetime.fromtimestamp(tick.time, timezone.utc).isoformat(),
        },
        "candles": candles,
        "source": "MetaTrader 5 local terminal",
    }


def multi_rates(symbol: str, frames: list[str], count: int) -> dict[str, Any]:
    results = {frame: rates(symbol, frame, count) for frame in frames if frame in TIMEFRAMES}
    available = [frame for frame, payload in results.items() if payload.get("ok")]
    return {
        "ok": bool(available),
        "requested": symbol,
        "requestedTimeframes": frames,
        "availableTimeframes": available,
        "results": results,
        "source": "MetaTrader 5 local terminal",
    }


def _ema(values: list[float], period: int) -> float:
    if not values:
        return 0.0
    alpha = 2.0 / (period + 1.0)
    result = values[0]
    for value in values[1:]:
        result = alpha * value + (1.0 - alpha) * result
    return result


def _scan_frame(symbol: str, frame: int, count: int = 180) -> dict[str, Any] | None:
    rows = mt5.copy_rates_from_pos(symbol, frame, 0, count)
    if rows is None or len(rows) < 80:
        return None
    closes = [float(row["close"]) for row in rows]
    highs = [float(row["high"]) for row in rows]
    lows = [float(row["low"]) for row in rows]
    volumes = [int(row["tick_volume"]) for row in rows]
    ema20, ema50 = _ema(closes, 20), _ema(closes, 50)
    ranges = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1])) for i in range(1, len(closes))]
    atr = sum(ranges[-14:]) / 14 if len(ranges) >= 14 else 0.0
    slope = (closes[-1] - closes[-12]) / max(abs(closes[-12]), 1e-12) * 100
    volume_mean = sum(volumes[-30:-1]) / max(len(volumes[-30:-1]), 1)
    relative_volume = volumes[-1] / volume_mean if volume_mean else 0.0
    direction = 1 if closes[-1] > ema20 > ema50 and slope > 0 else -1 if closes[-1] < ema20 < ema50 and slope < 0 else 0
    return {"close": closes[-1], "ema20": ema20, "ema50": ema50, "atr": atr, "slopePct": slope,
            "relativeVolume": relative_volume, "direction": direction, "bars": len(rows)}


def scan_market(limit: int) -> dict[str, Any]:
    symbols = mt5.symbols_get()
    if symbols is None:
        code, message = mt5.last_error()
        return {"ok": False, "error": "SYMBOLS_UNAVAILABLE", "detail": message, "code": code}
    candidates = []
    universe = [item for item in symbols if item.visible][:limit]
    if len(universe) < min(20, limit):
        universe = list(symbols)[:limit]
    for item in universe:
        mt5.symbol_select(item.name, True)
        h1 = _scan_frame(item.name, mt5.TIMEFRAME_H1)
        h4 = _scan_frame(item.name, mt5.TIMEFRAME_H4)
        tick = mt5.symbol_info_tick(item.name)
        if not h1 or not h4 or tick is None:
            continue
        aligned = h1["direction"] != 0 and h1["direction"] == h4["direction"]
        spread_points = max(0.0, (tick.ask - tick.bid) / item.point) if item.point else 0.0
        activity = min(20.0, max(0.0, h1["relativeVolume"] * 10.0))
        trend = min(45.0, abs(h1["slopePct"]) * 18.0 + abs(h4["slopePct"]) * 12.0)
        alignment = 25.0 if aligned else 8.0 if h1["direction"] or h4["direction"] else 0.0
        spread_penalty = min(25.0, spread_points / 4.0)
        tick_age_minutes = max(0.0, (datetime.now(timezone.utc).timestamp() - tick.time) / 60.0)
        stale = tick_age_minutes > 30.0
        score = round(max(0.0, min(45.0 if stale else 100.0, 25.0 + trend + alignment + activity - spread_penalty)), 1)
        direction = "ESPERAR" if stale else "BUY" if aligned and h1["direction"] > 0 else "SELL" if aligned else "ESPERAR"
        candidates.append({"symbol": item.name, "canonical": canonical_symbol(item.name), "description": item.description,
                           "path": item.path, "direction": direction, "score": score, "spreadPoints": round(spread_points, 1),
                           "tickAgeMinutes": round(tick_age_minutes, 1), "marketStatus": "DESACTUALIZADO/CERRADO" if stale else "ACTIVO",
                           "h1": h1, "h4": h4, "observedAt": datetime.now(timezone.utc).isoformat(),
                           "source": "MetaTrader 5 local terminal"})
    candidates.sort(key=lambda item: item["score"], reverse=True)
    return {"ok": True, "scanned": len(universe), "qualified": len(candidates), "candidates": candidates[:50],
            "method": "H1/H4 prefilter; deep analysis required", "permissions": "read-only",
            "checkedAt": datetime.now(timezone.utc).isoformat()}


def factor_snapshot() -> dict[str, Any]:
    requested = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "US100", "US500", "XAUUSD", "WTI", "BTCUSD"]
    factors, errors = [], []
    for universal in requested:
        item = find_symbol(universal)
        if item is None:
            errors.append(f"{universal}: no disponible en el bróker")
            continue
        mt5.symbol_select(item.name, True)
        rows = mt5.copy_rates_from_pos(item.name, mt5.TIMEFRAME_H1, 0, 150)
        tick = mt5.symbol_info_tick(item.name)
        if rows is None or len(rows) < 121 or tick is None:
            errors.append(f"{universal}: historial H1 insuficiente")
            continue
        closes = [float(row["close"]) for row in rows]
        returns = [(closes[i] / closes[i-1] - 1) * 100 for i in range(1, len(closes)) if closes[i-1]]
        mean = sum(returns[-48:]) / max(1, len(returns[-48:]))
        variance = sum((x - mean) ** 2 for x in returns[-48:]) / max(1, len(returns[-48:]))
        age = max(0.0, (datetime.now(timezone.utc).timestamp() - tick.time) / 60.0)
        factors.append({"id": universal, "symbol": item.name, "description": item.description,
                        "price": closes[-1], "change1h": (closes[-1] / closes[-2] - 1) * 100,
                        "change24h": (closes[-1] / closes[-25] - 1) * 100,
                        "change5d": (closes[-1] / closes[-121] - 1) * 100,
                        "volatility48h": variance ** 0.5, "tickAgeMinutes": age,
                        "fresh": age <= 30, "source": "MetaTrader 5 local terminal"})
    return {"ok": bool(factors), "factors": factors, "errors": errors,
            "checkedAt": datetime.now(timezone.utc).isoformat(), "permissions": "read-only"}


def microstructure(symbol: str) -> dict[str, Any]:
    item = find_symbol(symbol)
    if item is None:
        return {"ok": False, "error": "SYMBOL_NOT_FOUND", "requested": symbol}
    mt5.symbol_select(item.name, True)
    now = datetime.now(timezone.utc)
    ticks = mt5.copy_ticks_from(item.name, now - timedelta(minutes=15), 10000, mt5.COPY_TICKS_ALL)
    if ticks is None or len(ticks) < 2:
        code, message = mt5.last_error()
        return {"ok": False, "error": "TICKS_UNAVAILABLE", "detail": message, "code": code}
    mids, spreads, buy_flags, sell_flags, real_volume = [], [], 0, 0, 0.0
    for tick in ticks:
        bid, ask = float(tick["bid"]), float(tick["ask"])
        if bid > 0 and ask > 0:
            mids.append((bid + ask) / 2)
            spreads.append((ask - bid) / item.point if item.point else ask - bid)
        flags = int(tick["flags"])
        if flags & mt5.TICK_FLAG_BUY: buy_flags += 1
        if flags & mt5.TICK_FLAG_SELL: sell_flags += 1
        real_volume += float(tick["volume_real"])
    upticks = sum(1 for a, b in zip(mids, mids[1:]) if b > a)
    downticks = sum(1 for a, b in zip(mids, mids[1:]) if b < a)
    directional = upticks + downticks
    tick_imbalance = (upticks - downticks) / directional if directional else 0.0
    trade_flags = buy_flags + sell_flags
    trade_imbalance = (buy_flags - sell_flags) / trade_flags if trade_flags else None
    depth, depth_available = [], False
    if mt5.market_book_add(item.name):
        try:
            book = mt5.market_book_get(item.name) or []
            depth = [{"type": int(row.type), "price": float(row.price), "volume": float(row.volume_dbl)} for row in book]
            depth_available = bool(depth)
        finally:
            mt5.market_book_release(item.name)
    sell_depth = sum(x["volume"] for x in depth if x["type"] in (1, 3))
    buy_depth = sum(x["volume"] for x in depth if x["type"] in (2, 4))
    depth_total = buy_depth + sell_depth
    return {"ok": True, "requested": symbol, "symbol": item.name, "windowMinutes": 15,
            "tickCount": len(ticks), "midObservations": len(mids), "spreadPointsCurrent": spreads[-1] if spreads else None,
            "spreadPointsMean": sum(spreads) / len(spreads) if spreads else None,
            "spreadPointsMax": max(spreads) if spreads else None, "tickImbalance": tick_imbalance,
            "tradeFlagImbalance": trade_imbalance, "buyTradeFlags": buy_flags, "sellTradeFlags": sell_flags,
            "realVolume": real_volume, "depthAvailable": depth_available, "depth": depth,
            "buyDepth": buy_depth, "sellDepth": sell_depth,
            "depthImbalance": (buy_depth - sell_depth) / depth_total if depth_total else None,
            "quality": "REAL_TRADES_AND_DOM" if real_volume > 0 and depth_available else "BROKER_TICKS_AND_OPTIONAL_DOM",
            "observedAt": now.isoformat(), "source": "MetaTrader 5 local terminal", "permissions": "read-only"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["status", "catalog", "rates", "multi_rates", "scan", "portfolio", "factors", "microstructure"])
    parser.add_argument("--search", default="")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--symbol", default="EUR/USD")
    parser.add_argument("--timeframe", default="H1")
    parser.add_argument("--timeframes", default=",".join(TIMEFRAMES))
    parser.add_argument("--count", type=int, default=300)
    args = parser.parse_args()
    connect()
    try:
        if args.command == "status":
            emit(sanitized_status())
        if args.command == "portfolio":
            emit(portfolio())
        if args.command == "factors":
            emit(factor_snapshot())
        if args.command == "microstructure":
            emit(microstructure(args.symbol))
        if args.command == "catalog":
            emit(catalog(args.search, max(1, min(args.limit, 2000))))
        if args.command == "scan":
            emit(scan_market(max(10, min(args.limit, 500))))
        if args.command == "multi_rates":
            frames = [item.strip().upper() for item in args.timeframes.split(",") if item.strip()]
            emit(multi_rates(args.symbol, frames, max(60, min(args.count, 1000))))
        emit(rates(args.symbol, args.timeframe, max(10, min(args.count, 5000))))
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
