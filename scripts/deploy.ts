import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  const LOP_ADDRESSES: Record<number, string> = {
    11155111: "0x352f24B4dD631629088Ca1b01531118960F2C3De",
  };

  const lopAddress = LOP_ADDRESSES[Number(network.chainId)];
  if (!lopAddress) {
    throw new Error(`Limit Order Protocol not deployed on chainId ${network.chainId}`);
  }

  console.log(`Deploying Resolver to Sepolia testnet (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Sepolia LOP Address: ${lopAddress}`);

  const Resolver = await ethers.getContractFactory("Resolver");
  const resolver = await Resolver.deploy(lopAddress, deployer.address);
  await resolver.waitForDeployment();

  const resolverAddress = await resolver.getAddress();
  console.log(`Resolver deployed: ${resolverAddress}`);
  console.log(`Add to .env: RESOLVER_CONTRACT_ADDRESS=${resolverAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  }); 