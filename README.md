# Seatbelt

**Perps with a seatbelt.** Tell it the most you're willing to lose, and it places a dreamDEX perps order on Somnia testnet with a stop that keeps you inside that number. The stop always sits before liquidation.

```
you:      long ETH 5x max loss 20
seatbelt: Long 0.315 ETH at 2,115.48 (5x)
          Stop 2,052.02, liquidation 1,745.27
          Most you can lose: 19.99 USDso
```

Built for the [dreamDEX Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty/detail) on [DoraHacks](https://dorahacks.io), with [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) 0.32.1 on the Hideki perps testnet (chain 50383).

> **Status: work in progress.** The market reader, the order parser and the risk maths work and are tested. Live order placement, the Telegram bot and the trade card come next.

## Who it's for

People who want to try leverage without the "I got liquidated overnight" story. You think in "how much can I lose", not in margin ratios.

## How the maths works

Rules from the dreamDEX perps docs: no trading fees, and maintenance margin is half the market's initial margin (BTC and ETH: 5% / 2.5%).

1. With isolated margin at leverage `L`, liquidation is a price move of `1/L − maintenance` against you.
2. The stop sits at most 80% of that distance away, leaving room for slippage.
3. Seatbelt sizes the position so that a fill at the stop loses no more than your max loss. Quantities are rounded down to the market's lot size and the stop is rounded toward the entry, so rounding never adds loss.
4. If you fix the size yourself, the stop goes where the loss equals your max, or just inside liquidation if your max can't be reached first.

Max loss is before slippage: a stop is a market order and can fill past its price in a fast move. Seatbelt tells you this every time.

## Run it

```bash
npm install
npm test          # parser + risk maths
npm run doctor    # read-only: lists every perps market with its live mark price (no key needed)
```

## Layout

| Path | What it does |
| --- | --- |
| `src/doctor.ts` | Read-only check of the perps testnet through the Markets SDK |
| `src/parse.ts` | Plain-English order → side, market, leverage, max loss, optional size |
| `src/risk.ts` | Stop price, size, margin and liquidation price that respect the max loss |
| `src/new-wallet.ts` | Makes a fresh testnet-only wallet; the key goes to `.env`, never printed |
| `tests/` | Vitest tests for the parser and the risk maths |
| `feedback/` | Bug and docs reports for the bounty's feedback track, one file each |

## Licence

MIT. Uses the dreamDEX bot kit (MIT, © DreamDEX S.A.) as reference material only; no code is copied from it.
