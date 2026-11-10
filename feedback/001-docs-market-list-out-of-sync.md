# Perps docs list 21 markets, but listPerpMarkets() returns 22, including an undocumented ADLT market
Severity: normal
Area: docs

## Steps to reproduce
1. Read "Perps on Testnet" (app.testnet.dreamdex.io/docs/trading/perps-testnet). It says "All 21 markets are margined in USDso" and its table lists 21 markets.
2. Call `markets.client.listPerpMarkets()` with `@somnia-chain/markets-sdk@0.32.1` against Hideki testnet (chain 50383), indexer `https://hideki-dev.smk.somnia.host/v1/graphql`.

## Expected
The SDK returns the 21 documented markets, or the docs list every market the SDK returns.

## Actual
The SDK returns 22 markets. The extra one is `ADLT`, pool `0xe3f6dcda98595764970e5a6ffd167af1d1b35123`, mark price 3450 USDso. It is not in the docs table, so builders can't tell its max leverage, margin, tick, minimum size, or whether the Perps Arena credit can trade it.

## Evidence
`npx tsx src/doctor.ts` in this repo prints all 22 rows; the first is
`ADLT | pool 0xe3f6dcda98595764970e5a6ffd167af1d1b35123 | baseDecimals 18 | quoteDecimals 18 | mark 3450000000000000000000`.

## Environment
@somnia-chain/markets-sdk 0.32.1, Hideki testnet (chain 50383), read-only (no wallet), 10 Nov 2026.
