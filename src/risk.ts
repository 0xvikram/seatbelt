// Seatbelt's core: turn "the most I can lose" into a stop price and a position size that respect it,
// with the stop always placed before liquidation. Pure functions, no network.
//
// Rules from the dreamDEX perps testnet docs (Perps on Testnet, read 10 Nov 2026):
//   - maker and taker fees are 0;
//   - maintenance margin is half the market's initial margin (BTC/ETH 5% / 2.5%, ...);
//   - liquidation fee is up to 1% of the notional closed, only if liquidated.
// We assume isolated margin for the position: margin = notional / leverage, and it is liquidated when
// equity falls to notional × maintenance. That puts liquidation at a price move of (1/leverage − mmr).

export type Side = "long" | "short";

export interface MarketRules {
  symbol: string;
  markPrice: number; // in USDso per 1 base unit
  initialMarginBps: number; // e.g. 500 = 5%
  tickSize: number; // price step, in USDso
  lotSize: number; // quantity step, in base units
  minQuantity: number; // in base units
}

export interface SeatbeltInput {
  side: Side;
  leverage: number;
  maxLoss: number; // USDso the user accepts to lose at most
  notional?: number; // optional position value in USDso; if absent Seatbelt sizes it
}

export interface SeatbeltPlan {
  side: Side;
  symbol: string;
  leverage: number;
  entry: number;
  quantity: number; // base units, on the lot grid
  notional: number; // quantity × entry
  margin: number; // notional / leverage
  stopPrice: number;
  liquidationPrice: number;
  lossAtStop: number; // USDso lost if the stop fills exactly at stopPrice (before slippage)
  stopDistancePct: number;
  liquidationDistancePct: number;
  notes: string[];
}

/** How far the stop may sit, as a share of the distance to liquidation. Leaves room for slippage. */
export const STOP_BUFFER = 0.8;
/** When Seatbelt chooses the size, it aims for a stop this far away (or closer if liquidation is near). */
export const DEFAULT_STOP_PCT = 0.03;

const floorTo = (x: number, step: number) => Math.floor(x / step + 1e-9) * step;
const ceilTo = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;
const round = (x: number, step: number) => Number(x.toFixed(Math.max(0, Math.ceil(-Math.log10(step)))));

/**
 * Conservative on purpose. The docs say maintenance is half the initial margin, but on 10 Nov 2026 the live
 * initialMarginBps for ETH/BTC/SOL (250) and WLD (1000) disagreed with the docs' table while ADA (1000) matched
 * (see feedback/002). Maintenance can never exceed initial margin, so assuming maintenance = initial keeps the
 * stop before liquidation whichever source is right. The price: Seatbelt refuses the market's top leverage notch.
 */
export function maintenanceRate(m: MarketRules): number {
  return m.initialMarginBps / 10_000;
}

export function maxLeverage(m: MarketRules): number {
  return Math.floor(10_000 / m.initialMarginBps);
}

export function plan(m: MarketRules, input: SeatbeltInput): SeatbeltPlan {
  const { side, leverage, maxLoss } = input;
  if (!(maxLoss > 0)) throw new Error("Max loss must be more than 0");
  if (!(leverage >= 1)) throw new Error("Leverage must be at least 1x");
  if (leverage > maxLeverage(m)) throw new Error(`${m.symbol} allows at most ${maxLeverage(m)}x`);
  if (!(m.markPrice > 0)) throw new Error(`${m.symbol} has no live price right now`);

  const liqDist = 1 / leverage - maintenanceRate(m);
  if (liqDist <= 0) throw new Error(`${leverage}x leaves no room before liquidation on ${m.symbol}`);
  const maxStopDist = liqDist * STOP_BUFFER;
  const notes: string[] = [];

  let stopDist: number;
  let notional: number;
  if (input.notional !== undefined) {
    if (!(input.notional > 0)) throw new Error("Size must be more than 0");
    notional = input.notional;
    stopDist = maxLoss / notional;
    if (stopDist > maxStopDist) {
      stopDist = maxStopDist;
      notes.push(`At this size you cannot lose ${maxLoss} USDso before liquidation, so the stop sits just inside it.`);
    }
  } else {
    stopDist = Math.min(DEFAULT_STOP_PCT, maxStopDist);
    notional = maxLoss / stopDist;
  }

  const entry = m.markPrice;
  let quantity = floorTo(notional / entry, m.lotSize);
  if (quantity < m.minQuantity) {
    throw new Error(
      `That is below ${m.symbol}'s minimum size of ${m.minQuantity}. Raise your max loss or pick a smaller market.`,
    );
  }
  quantity = round(quantity, m.lotSize);

  // Round the stop TOWARD the entry, so the real loss is never above the promise.
  const rawStop = side === "long" ? entry * (1 - stopDist) : entry * (1 + stopDist);
  const stopPrice = round(side === "long" ? ceilTo(rawStop, m.tickSize) : floorTo(rawStop, m.tickSize), m.tickSize);
  const liquidationPrice = side === "long" ? entry * (1 - liqDist) : entry * (1 + liqDist);
  // Floating-point can push the product a hair above the promise; trim one lot until it is not.
  const lossFor = (q: number) => Math.abs(entry - stopPrice) * q;
  while (lossFor(quantity) > maxLoss && quantity - m.lotSize >= m.minQuantity) {
    quantity = round(quantity - m.lotSize, m.lotSize);
  }
  const lossAtStop = lossFor(quantity);
  if (lossAtStop > maxLoss) throw new Error("Cannot fit a stop inside your max loss at this market's minimum size");
  const realNotional = quantity * entry;
  notes.push("Max loss is before slippage: a stop is a market order and can fill past its price in a fast move.");

  return {
    side,
    symbol: m.symbol,
    leverage,
    entry,
    quantity,
    notional: realNotional,
    margin: realNotional / leverage,
    stopPrice,
    liquidationPrice,
    lossAtStop,
    stopDistancePct: (Math.abs(entry - stopPrice) / entry) * 100,
    liquidationDistancePct: liqDist * 100,
    notes,
  };
}
