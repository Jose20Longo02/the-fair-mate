import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const usdcAddress = process.env.POLYGON_USDC_ADDRESS || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  if (!rpcUrl || !privateKey || !treasuryAddress) {
    throw new Error("Set POLYGON_RPC_URL, TREASURY_PRIVATE_KEY and TREASURY_ADDRESS in .env");
  }

  const artifactPath = join(__dirname, "../artifacts/contracts/Deposit.sol/Deposit.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);

  const deposit = await factory.deploy(usdcAddress, treasuryAddress);
  await deposit.waitForDeployment();
  const address = await deposit.getAddress();

  console.log("Deposit contract deployed to:", address);
  console.log("USDC:", usdcAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("\nAdd to .env:");
  console.log(`POLYGON_DEPOSIT_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
