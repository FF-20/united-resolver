import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // Mainnet
    mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.RESOLVER_PRIVATE_KEY ? [process.env.RESOLVER_PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    // Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.public.blastapi.io",
      accounts: process.env.RESOLVER_PRIVATE_KEY ? [process.env.RESOLVER_PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: process.env.RESOLVER_PRIVATE_KEY ? [process.env.RESOLVER_PRIVATE_KEY] : [],
    },
    hardhat: {
      chainId: 1337,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config; 