# Live initialMarginBps disagrees with the documented margins for several perp markets
Severity: major
Area: docs

## Steps to reproduce
1. Read the market table in "Perps on Testnet" (app.testnet.dreamdex.io/docs/trading/perps-testnet). It lists BTC-PERP and ETH-PERP at 20x max leverage with 5% / 2.5% initial / maintenance margin, ADA-PERP at 10x with 10% / 5%, and WLD-PERP at 5x with 20% / 10%.
2. Call `markets.client.listPerpMarkets()` (`@somnia-chain/markets-sdk@0.32.1`, Hideki testnet, chain 50383) and read `initialMarginBps` on each row.

## Expected
`initialMarginBps` matches the documented initial margin: 500 for BTC and ETH, 1000 for ADA, 2000 for WLD.

## Actual
On 10 Nov 2026:

| Market | Docs initial / maintenance | Live `initialMarginBps` |
| --- | --- | --- |
| BTC | 5% / 2.5% | 250 |
| ETH | 5% / 2.5% | 250 |
| SOL | 5% / 2.5% | 250 |
| ADA | 10% / 5% | 1000 (matches) |
| WLD | 20% / 10% | 1000 |

For BTC, ETH, SOL and WLD the live value equals the documented maintenance margin, not the initial margin. Either the docs are out of date (live max leverage is 40x / 10x, not 20x / 5x) or the field holds a different quantity than its name says. A bot that sizes stops from "maintenance = half of initialMarginBps", as the docs' rule implies, would place stops past the real liquidation price if the docs are the truth.

## Evidence
`npx tsx scratch/m.ts`-style read of `listPerpMarkets()`:
`BTC initialMarginBps 250`, `ETH initialMarginBps 250`, `SOL initialMarginBps 250`, `ADA initialMarginBps 1000`, `WLD initialMarginBps 1000`.

## Environment
@somnia-chain/markets-sdk 0.32.1, Hideki testnet (chain 50383), read-only, 10 Nov 2026.
