// FHEVM SDK utilities for frontend
import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers";

// Import @zama-fhe/relayer-sdk - use static import
// Note: Vite config excludes this from optimization
import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";

// Import @fhevm/mock-utils for localhost mock FHEVM
// Note: Use dynamic import to avoid including in production bundle
let MockFhevmInstance: any = null;

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

let fhevmInstance: FhevmInstance | null = null;
let isSDKInitialized = false;
let isMockInstance = false;

// Initialize FHEVM instance
// Note: @zama-fhe/relayer-sdk requires window.ethereum (EIP-1193 provider)
export async function initializeFHEVM(chainId?: number): Promise<FhevmInstance> {
  if (!fhevmInstance) {
    // Check if window.ethereum is available
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("window.ethereum is not available. Please install MetaMask or another Web3 wallet.");
    }

    // Initialize SDK first (loads WASM)
    if (!isSDKInitialized) {
      console.log("Initializing FHE SDK...");
      await initSDK();
      isSDKInitialized = true;
      console.log("FHE SDK initialized");
    }

    // Get chain ID from window.ethereum if not provided
    let currentChainId = chainId;
    if (!currentChainId) {
      try {
        const chainIdHex = await (window as any).ethereum.request({ method: "eth_chainId" });
        currentChainId = parseInt(chainIdHex, 16);
      } catch (error) {
        console.error("Failed to get chain ID:", error);
        currentChainId = 31337; // Default to localhost
      }
    }

    // Configure FHEVM instance
    // Note: For localhost (chainId 31337), we still need to use SepoliaConfig
    // because FHEVM contracts are deployed on Sepolia, not localhost
    // We need to ensure FHEVM SDK can access Sepolia network
    // Solution: Use Sepolia RPC URL directly for FHEVM contracts
    let config: any;
    
    if (currentChainId === 31337) {
      // For localhost (chainId 31337), use Hardhat's FHEVM mock
      // Hardhat node provides FHEVM mock functionality via @fhevm/hardhat-plugin
      // We need to fetch FHEVM metadata from Hardhat node and use @fhevm/mock-utils
      const localhostRpcUrl = "http://localhost:8545";
      
      try {
        // Fetch FHEVM metadata from Hardhat node
        const provider = new JsonRpcProvider(localhostRpcUrl);
        const metadata = await provider.send("fhevm_relayer_metadata", []);
        
        if (metadata && metadata.ACLAddress && metadata.InputVerifierAddress && metadata.KMSVerifierAddress) {
          // Use @fhevm/mock-utils to create mock FHEVM instance
          if (!MockFhevmInstance) {
            // Dynamic import to avoid including in production bundle
            const mockUtils = await import("@fhevm/mock-utils");
            MockFhevmInstance = mockUtils.MockFhevmInstance;
          }
          
          const mockInstance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            chainId: 31337,
            gatewayChainId: 55815,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
            verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
          });
          
          fhevmInstance = mockInstance;
          isMockInstance = true;
          console.log("FHEVM mock instance created successfully");
          console.log("Mock instance details:", {
            aclAddress: metadata.ACLAddress,
            inputVerifierAddress: metadata.InputVerifierAddress,
            kmsVerifierAddress: metadata.KMSVerifierAddress,
          });
          return fhevmInstance;
        }
      } catch (error: any) {
        console.warn("Failed to create FHEVM mock instance:", error);
        // Fall through to try SepoliaConfig
      }
      
      // Fallback: try using SepoliaConfig with localhost RPC
      config = {
        ...SepoliaConfig,
        // Use localhost RPC URL for mock FHEVM
        network: localhostRpcUrl,
        // Use localhost chainId for mock FHEVM
        chainId: 31337,
      };
    } else {
      // For other networks, use SepoliaConfig as is
      config = {
        ...SepoliaConfig,
        network: (window as any).ethereum,
      };
    }
    
    try {
      console.log("Creating FHEVM instance with config:", config);
      
      // Add a small delay to ensure SDK is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      fhevmInstance = await createInstance(config);
      console.log("FHEVM instance created successfully");
    } catch (error: any) {
      console.error("Failed to create FHEVM instance:", error);
      
      // Provide more detailed error message
      let errorMessage = "FHEVM 实例创建失败";
      if (error.message) {
        if (currentChainId === 31337) {
          // For localhost, provide localhost-specific error messages
          if (error.message.includes("fetch") || error.message.includes("network")) {
            errorMessage = "无法连接到本地 Hardhat 节点。请确保 Hardhat 节点正在运行（npx hardhat node）。";
          } else if (error.message.includes("timeout")) {
            errorMessage = "请求超时。请检查 Hardhat 节点是否正在运行。";
          } else if (error.message.includes("getCoprocessorSigners") || error.message.includes("BAD_DATA")) {
            errorMessage = "无法从本地 Hardhat 节点获取 FHEVM 合约数据。请确保 Hardhat 节点正在运行，并且已部署 FHEVM 合约。";
          } else {
            errorMessage = `FHEVM 实例创建失败: ${error.message}`;
          }
        } else {
          // For other networks, provide Sepolia-specific error messages
          if (error.message.includes("fetch") || error.message.includes("network")) {
            errorMessage = "无法连接到 Sepolia 网络。请检查您的网络连接，或稍后重试。";
          } else if (error.message.includes("timeout")) {
            errorMessage = "请求超时。请检查您的网络连接，或稍后重试。";
          } else if (error.message.includes("getCoprocessorSigners") || error.message.includes("BAD_DATA")) {
            errorMessage = "无法从 Sepolia 网络获取 FHEVM 合约数据。请确保您的网络连接正常，或切换到 Sepolia 网络。";
          } else {
            errorMessage = `FHEVM 实例创建失败: ${error.message}`;
          }
        }
      } else {
        errorMessage = "无法获取数据。请检查您的网络连接，或稍后重试。";
      }
      
      throw new Error(errorMessage);
    }
  }
  return fhevmInstance;
}

// Get or initialize FHEVM instance
// Note: This function now accepts chainId instead of provider
export async function getFHEVMInstance(chainId?: number): Promise<FhevmInstance> {
  return initializeFHEVM(chainId);
}

// Encrypt a value for voting
export async function encryptOptionIndex(
  fhevm: FhevmInstance,
  contractAddress: string,
  userAddress: string,
  optionIndex: number
): Promise<EncryptedInput> {
  try {
    const encryptedInput = fhevm
      .createEncryptedInput(contractAddress, userAddress)
      .add32(optionIndex);
    
    const encrypted = await encryptedInput.encrypt();
    
    // Convert Uint8Array to hex strings for contract calls
    // Note: handles[0] is the encrypted handle, inputProof is the proof
    // externalEuint32 is represented as bytes32 in the ABI, so we need to pad the handle to 32 bytes
    const handles = encrypted.handles.map(handle => {
      const hexHandle = ethers.hexlify(handle);
      // Pad to 32 bytes (64 hex characters) if needed
      // bytes32 requires exactly 32 bytes
      if (hexHandle.length < 66) { // 0x + 64 hex chars = 66
        // Pad with zeros to make it 32 bytes
        const padded = hexHandle.slice(2).padStart(64, '0');
        return `0x${padded}`;
      }
      // If longer than 32 bytes, take the first 32 bytes
      if (hexHandle.length > 66) {
        return hexHandle.slice(0, 66);
      }
      return hexHandle;
    });
    
    return {
      handles,
      inputProof: ethers.hexlify(encrypted.inputProof),
    };
  } catch (error: any) {
    console.error("Error encrypting option index:", error);
    throw new Error(`Failed to encrypt vote: ${error.message || "Unknown error"}`);
  }
}

// Decrypt vote count
// Note: This requires keypair generation and EIP712 signing
// For now, this is a placeholder - full implementation requires:
// 1. Generate keypair
// 2. Create EIP712 signature
// 3. Call userDecrypt with proper parameters
export async function decryptVoteCount(
  fhevm: FhevmInstance,
  encryptedValue: string,
  contractAddress: string,
  signer: ethers.Signer
): Promise<number> {
  // TODO: Implement full decryption flow
  // This requires keypair generation and EIP712 signing
  throw new Error("Decryption not fully implemented. Requires keypair and EIP712 signature.");
}
