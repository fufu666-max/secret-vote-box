import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";
import { defineChain } from "viem";

// Get contract address from environment
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || "";

// Define localhost chain with correct chainId (31337 for Hardhat)
const localhost = defineChain({
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://localhost:8545"],
    },
  },
});

// Configure chains
const chains = [localhost, sepolia] as const;

// RainbowKit configuration
// Note: For local development, WalletConnect remote config requests may fail (403)
// This is expected and won't affect functionality. For production, get a real projectId
// from https://cloud.reown.com (formerly cloud.walletconnect.com)
export const config = getDefaultConfig({
  appName: "Secret Vote Box",
  // Use a valid format projectId (32 hex characters) to reduce errors
  // For localhost, these 403 errors are expected and can be ignored
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "a4c3f8a6d7b2c1e8f9a5c3d2e1f4b6a9",
  chains,
  ssr: false,
  transports: {
    [localhost.id]: http("http://localhost:8545"),
    [sepolia.id]: http(),
  },
});

export { chains };

