// Plain-English orders → structured input. Accepts messages like:
//   "long ETH 5x max loss 20"
//   "short btc 10x risk 15 size 300"
//   "buy SOL 3x lose 10"
import type { Side } from "./risk";

export interface ParsedOrder {
  side: Side;
  symbol: string; // e.g. "ETH"
  leverage: number;
  maxLoss: number;
  notional?: number;
}

const SIDE: Record<string, Side> = { long: "long", buy: "long", short: "short", sell: "short" };

export function parseOrder(text: string): ParsedOrder {
  const t = text.trim().toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ");
  const side = t.match(/\b(long|buy|short|sell)\b/)?.[1];
  if (!side) throw new Error('Say "long" or "short", for example: long ETH 5x max loss 20');
  const symbol = t.match(/\b(?:long|buy|short|sell)\s+([a-z0-9]{2,10})\b/)?.[1];
  if (!symbol) throw new Error("Which market? For example: long ETH 5x max loss 20");
  const lev = t.match(/\b(\d+(?:\.\d+)?)\s*x\b/)?.[1];
  const loss = t.match(/\b(?:max loss|max-loss|risk|lose|loss)\s*(\d+(?:\.\d+)?)/)?.[1];
  if (!loss) throw new Error('Tell me the most you can lose, for example: "max loss 20"');
  const size = t.match(/\b(?:size|notional)\s*(\d+(?:\.\d+)?)/)?.[1];
  return {
    side: SIDE[side],
    symbol: symbol.toUpperCase().replace(/-?PERP$/, ""),
    leverage: lev ? Number(lev) : 1,
    maxLoss: Number(loss),
    ...(size ? { notional: Number(size) } : {}),
  };
}
