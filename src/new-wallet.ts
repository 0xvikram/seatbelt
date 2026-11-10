// Makes a fresh TESTNET-ONLY wallet for Seatbelt and saves its key to .env (gitignored).
// Prints only the address. Refuses to overwrite an existing key.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const path = new URL("../.env", import.meta.url);
const current = existsSync(path) ? readFileSync(path, "utf8") : "";
if (/^PRIVATE_KEY=0x[0-9a-fA-F]{64}/m.test(current)) {
  const addr = privateKeyToAccount(current.match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1] as `0x${string}`).address;
  console.log(`A wallet already exists in .env: ${addr} (not changed)`);
  process.exit(0);
}
const key = generatePrivateKey();
const address = privateKeyToAccount(key).address;
writeFileSync(path, `${current}${current && !current.endsWith("\n") ? "\n" : ""}# Testnet only. Never reuse this key on mainnet.\nPRIVATE_KEY=${key}\nWALLET_ADDRESS=${address}\n`, { mode: 0o600 });
console.log(`New testnet wallet saved to .env\nAddress: ${address}`);
