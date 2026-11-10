// Live side of Seatbelt: read a perp market, turn a plan into SDK calls, and (only with live=true) send them.
// Order of operations when live: set leverage → claim the paper USDso credit if eligible → market order →
// a reduce-only MARKET stop-loss for the whole position (quantity 0 = "whole position at trigger time").
import "dotenv/config";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { parseUnits, type Address } from "viem";
import type { MarketRules, SeatbeltPlan } from "./risk";

export const EXPLORER_TX = "https://explorer.testnet.somnia.network/tokyo/tx/";
const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql";

export function client(withKey: boolean) {
  const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (withKey && !pk) throw new Error("No PRIVATE_KEY in .env. Run: npx tsx src/new-wallet.ts");
  return new SomniaMarkets({
    // The SDK's chain object is typed against its own viem build; the cast only bridges the type.
    chain: hidekiTestnet as any,
    indexerUrl: INDEXER,
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    ...(withKey ? { privateKey: pk } : {}),
  });
}

export interface LiveMarket {
  rules: MarketRules;
  pool: Address;
  marginBank: Address;
  stopRegistry: Address;
  baseDecimals: number;
  quoteDecimals: number;
}

const big = (v: unknown) => BigInt(String(v));
const toNum = (raw: unknown, decimals: number) => Number(big(raw)) / 10 ** decimals;

export async function loadMarket(markets: SomniaMarkets, symbol: string): Promise<LiveMarket> {
  const rows = (await markets.client.listPerpMarkets()) as Array<Record<string, any>>;
  const m = rows.find((r) => String(r.baseSymbol).toUpperCase() === symbol.toUpperCase());
  if (!m) throw new Error(`No ${symbol} perp market. Try one of: ${rows.map((r) => r.baseSymbol).join(", ")}`);
  const bd = Number(m.baseDecimals);
  const qd = Number(m.quoteDecimals);
  return {
    rules: {
      symbol: m.baseSymbol,
      markPrice: toNum(m.markPrice, qd),
      initialMarginBps: Number(m.initialMarginBps),
      tickSize: toNum(m.tickSize, qd),
      lotSize: toNum(m.lotSize, bd),
      minQuantity: toNum(m.minQuantity, bd),
    },
    pool: m.poolAddress,
    marginBank: m.marginBank,
    stopRegistry: m.stopRegistry,
    baseDecimals: bd,
    quoteDecimals: qd,
  };
}

const raw = (x: number, decimals: number) => parseUnits(x.toFixed(decimals > 12 ? 12 : decimals), decimals);

/** The exact calls Seatbelt will make, in plain data, so a dry run can show them. */
export function buildCalls(m: LiveMarket, p: SeatbeltPlan) {
  const isLong = p.side === "long";
  // A market order needs a crossing price; 1% through the mark bounds the margin lock.
  const tick = m.rules.tickSize;
  const rawCross = isLong ? p.entry * 1.01 : p.entry * 0.99;
  // Prices must sit on the market's tick grid; round away from the mark so the order still crosses.
  const crossing = (isLong ? Math.ceil(rawCross / tick) : Math.floor(rawCross / tick)) * tick;
  return {
    leverage: { pool: m.pool, leverageX: p.leverage, marginBank: m.marginBank },
    order: {
      pool: m.pool,
      isBid: isLong,
      price: raw(crossing, m.quoteDecimals),
      quantity: raw(p.quantity, m.baseDecimals),
      orderType: 2, // market (IOC)
    },
    stopLoss: {
      registry: m.stopRegistry,
      pool: m.pool,
      isBid: !isLong, // the stop closes the position, so it trades the other way
      quantity: 0n, // whole position at trigger time
      triggerPrice: raw(p.stopPrice, m.quoteDecimals),
      triggerOperator: (isLong ? 1 : 0) as 0 | 1, // long: fire when mark ≤ stop; short: when mark ≥ stop
      stopOrderType: 1 as const, // MARKET
      limitPrice: 0n,
    },
  };
}

export interface ExecResult {
  live: boolean;
  txs: { step: string; hash?: string }[];
  notes: string[];
}

/** Sends the calls. Never called unless the user passed --live. */
export async function execute(markets: SomniaMarkets, m: LiveMarket, p: SeatbeltPlan): Promise<ExecResult> {
  const calls = buildCalls(m, p);
  const txs: ExecResult["txs"] = [];
  const notes: string[] = [];
  const me = markets.walletAddress as Address;

  const elig = await markets.client.getPerpVoucherEligibility(m.marginBank, me);
  if ((elig as any)?.eligible) {
    const r: any = await markets.trader.claimPerpVoucher({ marginBank: m.marginBank });
    txs.push({ step: "claim 1,000 paper USDso", hash: r?.hash ?? r?.txHash });
  }

  const max: any = await markets.client.getMaxPerpOrderSize({ pool: m.pool, marginBank: m.marginBank, account: me, isBid: calls.order.isBid, price: calls.order.price });
  if (!max?.priceable) throw new Error("No live mark price to size against right now. Try again in a minute.");
  if (!max?.placeable || calls.order.quantity > BigInt(max.maxQuantity)) {
    throw new Error(`This account can't open that size yet (limited by ${max?.limitedBy ?? "margin"}).`);
  }

  const lev: any = await markets.trader.setPerpLeverage(calls.leverage);
  txs.push({ step: `set leverage ${p.leverage}x`, hash: lev?.hash ?? lev?.txHash });
  const ord: any = await markets.trader.placePerpOrder(calls.order);
  txs.push({ step: `${p.side} ${p.quantity} ${p.symbol}`, hash: ord?.hash ?? ord?.txHash });
  const sl: any = await markets.trader.placePerpStopOrder(calls.stopLoss);
  txs.push({ step: `stop-loss at ${p.stopPrice}`, hash: sl?.hash ?? sl?.txHash });
  notes.push("The stop holds 0.15 STT until it fires or is cancelled.");
  return { live: true, txs, notes };
}
