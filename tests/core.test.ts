import { describe, expect, it } from "vitest";
import { parseOrder } from "../src/parse";
import { maintenanceRate, maxLeverage, plan, type MarketRules } from "../src/risk";

const ETH: MarketRules = { symbol: "ETH", markPrice: 2000, initialMarginBps: 500, tickSize: 0.01, lotSize: 0.001, minQuantity: 0.004 };
const ADA: MarketRules = { symbol: "ADA", markPrice: 0.5, initialMarginBps: 1000, tickSize: 0.0001, lotSize: 1, minQuantity: 46 };

describe("parseOrder", () => {
  it("reads a full order", () => {
    expect(parseOrder("long ETH 5x max loss 20")).toEqual({ side: "long", symbol: "ETH", leverage: 5, maxLoss: 20 });
  });
  it("accepts buy/sell, size and -PERP", () => {
    expect(parseOrder("Sell btc-perp 10x risk 15 size 300")).toEqual({ side: "short", symbol: "BTC", leverage: 10, maxLoss: 15, notional: 300 });
  });
  it("defaults to 1x when no leverage is given", () => {
    expect(parseOrder("buy sol lose 10").leverage).toBe(1);
  });
  it("explains what is missing", () => {
    expect(() => parseOrder("ETH 5x max loss 20")).toThrow(/long.*short/);
    expect(() => parseOrder("long ETH 5x")).toThrow(/most you can lose/);
  });
});

describe("market rules", () => {
  it("maintenance is half the initial margin; max leverage follows initial margin", () => {
    expect(maintenanceRate(ETH)).toBe(0.025);
    expect(maxLeverage(ETH)).toBe(20);
    expect(maxLeverage(ADA)).toBe(10);
  });
});

describe("plan", () => {
  it("sizes the position so the stop costs at most the max loss (Seatbelt picks the size)", () => {
    const p = plan(ETH, { side: "long", leverage: 5, maxLoss: 20 });
    // liquidation 1/5 - 2.5% = 17.5% away; stop at 3% (default); notional = 20 / 3% ≈ 666
    expect(p.stopDistancePct).toBeLessThanOrEqual(3 + 1e-9);
    expect(p.lossAtStop).toBeLessThanOrEqual(20);
    expect(p.lossAtStop).toBeGreaterThan(19.9);
    expect(p.stopPrice).toBeLessThan(p.entry);
    expect(p.liquidationPrice).toBeCloseTo(2000 * (1 - 0.175), 6);
    expect(p.stopPrice).toBeGreaterThan(p.liquidationPrice);
    expect(p.margin).toBeCloseTo(p.notional / 5, 6);
  });
  it("mirrors for shorts: stop above entry, below liquidation", () => {
    const p = plan(ETH, { side: "short", leverage: 10, maxLoss: 10 });
    expect(p.stopPrice).toBeGreaterThan(p.entry);
    expect(p.stopPrice).toBeLessThan(p.liquidationPrice);
    expect(p.lossAtStop).toBeLessThanOrEqual(10);
  });
  it("at high leverage the stop moves closer so it still fires before liquidation", () => {
    const p = plan(ETH, { side: "long", leverage: 20, maxLoss: 20 });
    // 1/20 - 2.5% = 2.5% to liquidation; stop at 80% of that = 2%
    expect(p.liquidationDistancePct).toBeCloseTo(2.5, 6);
    expect(p.stopDistancePct).toBeLessThanOrEqual(2 + 1e-9);
    expect(p.stopPrice).toBeGreaterThan(p.liquidationPrice);
  });
  it("with a fixed size, the stop sits where the loss equals the max loss", () => {
    const p = plan(ETH, { side: "long", leverage: 5, maxLoss: 10, notional: 1000 });
    expect(p.stopDistancePct).toBeCloseTo(1, 1);
    expect(p.lossAtStop).toBeLessThanOrEqual(10);
  });
  it("with a small fixed size, it says the max loss can't even be reached, and keeps the stop inside liquidation", () => {
    const p = plan(ETH, { side: "long", leverage: 10, maxLoss: 50, notional: 100 });
    expect(p.notes[0]).toMatch(/cannot lose 50/);
    expect(p.stopPrice).toBeGreaterThan(p.liquidationPrice);
  });
  it("never promises more loss than asked, after rounding to the lot and tick grid", () => {
    for (const maxLoss of [5, 7.3, 13, 20, 99]) {
      for (const lev of [1, 3, 7, 10]) {
        const p = plan(ADA, { side: "long", leverage: lev, maxLoss });
        expect(p.lossAtStop).toBeLessThanOrEqual(maxLoss);
        expect(Number.isInteger(p.quantity)).toBe(true);
      }
    }
  });
  it("refuses leverage above the market's maximum and sizes below the minimum", () => {
    expect(() => plan(ADA, { side: "long", leverage: 20, maxLoss: 10 })).toThrow(/at most 10x/);
    expect(() => plan(ETH, { side: "long", leverage: 2, maxLoss: 0.1 })).toThrow(/minimum size/);
  });
});
