// Read-only check of the dreamDEX perps testnet (Hideki, chain 50383). Sends nothing and needs no key.
// Prints each perp market with its live mark price and the sizing rules Seatbelt must respect.
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const markets = new SomniaMarkets({
  // The SDK's chain object is typed against its own viem build; the cast only bridges the type.
  chain: hidekiTestnet as any,
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
});

const perps = await markets.client.listPerpMarkets();
console.log(`${perps.length} perp markets on Hideki testnet`);
const row = perps[0] as Record<string, unknown>;
console.log("market row fields:", Object.keys(row).join(", "));
for (const m of perps as Array<Record<string, any>>) {
  console.log(
    [m.baseSymbol, `pool ${m.poolAddress}`, `baseDecimals ${m.baseDecimals}`, `quoteDecimals ${m.quoteDecimals}`, `mark ${m.markPrice ?? m.mark ?? "?"}`].join(" | "),
  );
}
