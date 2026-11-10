// Seatbelt from the terminal.
//   npx tsx src/cli.ts "long ETH 5x max loss 20"          dry run: live prices, prints the plan and the calls
//   npx tsx src/cli.ts "long ETH 5x max loss 20" --live   sends them (needs STT for gas in the .env wallet)
import { parseOrder } from "./parse";
import { plan } from "./risk";
import { EXPLORER_TX, buildCalls, client, execute, loadMarket } from "./trade";
import { describePlan } from "./describe";

const args = process.argv.slice(2);
const live = args.includes("--live");
const text = args.filter((a) => a !== "--live").join(" ");
if (!text) {
  console.log('Usage: npx tsx src/cli.ts "long ETH 5x max loss 20" [--live]');
  process.exit(1);
}

const order = parseOrder(text);
const markets = client(live);
const m = await loadMarket(markets, order.symbol);
const p = plan(m.rules, order);
console.log(describePlan(p));

if (!live) {
  const c = buildCalls(m, p);
  console.log("\nDry run. These calls would be sent with --live:");
  console.log(JSON.stringify(c, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  process.exit(0);
}
const r = await execute(markets, m, p);
for (const t of r.txs) console.log(`${t.step}: ${t.hash ? EXPLORER_TX + t.hash : "(no hash returned)"}`);
for (const n of r.notes) console.log(n);
