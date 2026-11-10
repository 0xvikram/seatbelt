// The one message a user reads before trading: plain words, real numbers, the promise and its limit.
import type { SeatbeltPlan } from "./risk";

const fmt = (x: number, d = 2) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function describePlan(p: SeatbeltPlan): string {
  const verb = p.side === "long" ? "Long" : "Short";
  return [
    `${verb} ${p.quantity} ${p.symbol} at ${fmt(p.entry)} (${p.leverage}x, margin ${fmt(p.margin)} USDso)`,
    `Stop ${fmt(p.stopPrice)}, ${fmt(p.stopDistancePct, 1)}% away. Liquidation ${fmt(p.liquidationPrice)}, ${fmt(p.liquidationDistancePct, 1)}% away.`,
    `Most you can lose: ${fmt(p.lossAtStop)} USDso`,
    ...p.notes.map((n) => `Note: ${n}`),
  ].join("\n");
}
