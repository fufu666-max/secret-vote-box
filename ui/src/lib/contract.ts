import { ethers } from "ethers";
// Note: These types will be generated after contract compilation
// import { SecretVoteBox__factory, SecretVoteBox } from "../../../types/contracts";

// Contract addresses for different networks
const CONTRACT_ADDRESSES: Record<number, string> = {
  31337: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // localhost (Hardhat)
  11155111: "0x638A70A2901fD2e644EC3625B7674A25ceB33c59", // Sepolia testnet
};

// Network configuration
export const NETWORK_CONFIG = {
  localhost: {
    chainId: 31337,
    name: "Localhost",
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
  },
};

// Get contract address based on chainId
// Falls back to environment variable or localhost address if chainId is not found
export function getContractAddress(chainId?: number): string {
  // If chainId is provided and exists in our mapping, use it
  if (chainId && CONTRACT_ADDRESSES[chainId]) {
    return CONTRACT_ADDRESSES[chainId];
  }
  
  // Fallback to environment variable
  if (import.meta.env.VITE_CONTRACT_ADDRESS) {
    return import.meta.env.VITE_CONTRACT_ADDRESS;
  }
  
  // Default to localhost address
  return CONTRACT_ADDRESSES[31337];
}

// Default contract address (for backward compatibility)
// Use getContractAddress(chainId) instead when chainId is available
export const CONTRACT_ADDRESS = CONTRACT_ADDRESSES[31337];

export interface Poll {
  id: number;
  title: string;
  description: string;
  options: string[];
  expireAt: bigint;
  creator: string;
  isActive: boolean;
}

export interface EncryptedVoteCount {
  encrypted: string;
  decrypted?: number;
}

// Contract ABI - This should match the SecretVoteBox contract
// Note: externalEuint32 is represented as bytes32 in the ABI (not bytes)
const CONTRACT_ABI = [
  "function createPoll(string memory title, string memory description, string[] memory options, uint256 expireAt) external returns (uint256 pollId)",
  "function vote(uint256 pollId, bytes32 optionIndex, bytes calldata inputProof) external",
  "function getPoll(uint256 pollId) external view returns (string memory title, string memory description, string[] memory options, uint256 expireAt, address creator, bool isActive)",
  "function getEncryptedVoteCount(uint256 pollId, uint256 optionIndex) external view returns (bytes32)",
  "function hasVoted(uint256 pollId, address voter) external view returns (bool)",
  "function getPollCount() external view returns (uint256)",
  "function endPoll(uint256 pollId) external",
  "event PollCreated(uint256 indexed pollId, address indexed creator, string title, uint256 expireAt)",
  "event VoteCast(uint256 indexed pollId, address indexed voter)",
  "event PollEnded(uint256 indexed pollId)",
] as const;

// Get contract instance
export function getContract(signer: ethers.Signer, chainId?: number): ethers.Contract {
  const contractAddress = getContractAddress(chainId);
  if (!contractAddress) {
    throw new Error("Contract address not set. Please deploy the contract first.");
  }
  return new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
}

// Get contract instance for read-only operations
export function getContractReadOnly(provider: ethers.Provider, chainId?: number): ethers.Contract {
  const contractAddress = getContractAddress(chainId);
  if (!contractAddress) {
    throw new Error("Contract address not set. Please deploy the contract first.");
  }
  return new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
}

// Request finalize (decrypt and publish clear results)
export async function requestFinalize(
  signer: ethers.Signer,
  pollId: number,
  chainId?: number
): Promise<ethers.ContractTransactionResponse> {
  const contract = getContract(signer, chainId);
  return await contract.requestFinalize(pollId) as Promise<ethers.ContractTransactionResponse>;
}

// Check if poll is finalized (clear results published)
export async function isFinalized(
  provider: ethers.Provider,
  pollId: number,
  chainId?: number
): Promise<boolean> {
  const contract = getContractReadOnly(provider, chainId);
  return await contract.isFinalized(pollId);
}

// Get clear vote counts for a poll
export async function getClearVoteCounts(
  provider: ethers.Provider,
  pollId: number,
  chainId?: number
): Promise<number[]> {
  const contract = getContractReadOnly(provider, chainId);
  const counts: bigint[] = await contract.getClearVoteCounts(pollId);
  return counts.map((c) => Number(c));
}

// Create a poll
export async function createPoll(
  signer: ethers.Signer,
  title: string,
  description: string,
  options: string[],
  expireAt: Date,
  chainId?: number
): Promise<ethers.ContractTransactionResponse> {
  const contract = getContract(signer, chainId);
  const expireTimestamp = BigInt(Math.floor(expireAt.getTime() / 1000));
  
  try {
    // First, estimate gas to check if the transaction will succeed
    await contract.createPoll.estimateGas(title, description, options, expireTimestamp);
    
    // If estimation succeeds, send the transaction
    return await contract.createPoll(title, description, options, expireTimestamp) as Promise<ethers.ContractTransactionResponse>;
  } catch (error: any) {
    // Provide more detailed error information
    if (error.reason) {
      throw new Error(error.reason);
    } else if (error.data?.message) {
      throw new Error(error.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Failed to create poll. Please check your inputs and try again.");
    }
  }
}

// Cast a vote (encrypted)
// Note: This function requires the encrypted input to be passed in
// The encryption should be done using encryptOptionIndex from fhevm.ts
export async function castVote(
  signer: ethers.Signer,
  pollId: number,
  encryptedHandle: string,
  inputProof: string,
  chainId?: number
): Promise<ethers.ContractTransactionResponse> {
  const contract = getContract(signer, chainId);
  
  try {
    // For localhost/Hardhat network, we might need to skip estimateGas
    // and call the function directly, as FHE operations can cause issues with gas estimation
    const provider = await signer.provider;
    const network = await provider?.getNetwork();
    const isLocalhost = network?.chainId === 31337n;
    
    if (isLocalhost) {
      // For localhost, try calling directly without estimateGas
      // FHE operations on localhost might not work well with estimateGas
      console.log("Calling vote on localhost network (skipping estimateGas)");
      return await contract.vote(pollId, encryptedHandle, inputProof, {
        // Set a high gas limit for localhost
        gasLimit: 5000000n,
      }) as Promise<ethers.ContractTransactionResponse>;
    } else {
      // For other networks, use estimateGas first
      try {
        const gasEstimate = await contract.vote.estimateGas(pollId, encryptedHandle, inputProof);
        console.log("Gas estimate:", gasEstimate.toString());
        
        // If estimation succeeds, send the transaction
        return await contract.vote(pollId, encryptedHandle, inputProof) as Promise<ethers.ContractTransactionResponse>;
      } catch (estimateError: any) {
        console.error("Gas estimation failed:", estimateError);
        
        // Try to call the function directly to get the revert reason
        try {
          // Use staticCall to simulate the transaction and get revert reason
          await contract.vote.staticCall(pollId, encryptedHandle, inputProof);
        } catch (staticCallError: any) {
          // Extract revert reason if available
          if (staticCallError.reason) {
            throw new Error(staticCallError.reason);
          } else if (staticCallError.data?.message) {
            throw new Error(staticCallError.data.message);
          } else if (staticCallError.message) {
            // Check for common error patterns
            if (staticCallError.message.includes("Poll does not exist")) {
              throw new Error("Poll does not exist or is not active");
            } else if (staticCallError.message.includes("Poll has expired")) {
              throw new Error("Poll has expired");
            } else if (staticCallError.message.includes("Already voted")) {
              throw new Error("You have already voted on this poll");
            } else {
              throw new Error(`Transaction would fail: ${staticCallError.message}`);
            }
          } else {
            throw new Error("Transaction would fail. Please check if the poll exists, is active, and you haven't voted yet.");
          }
        }
        
        // If staticCall succeeded but estimateGas failed, there might be a gas issue
        throw new Error("Gas estimation failed. Please try again.");
      }
    }
  } catch (error: any) {
    // Provide more detailed error information
    let errorMessage = "Failed to cast vote. Please check your inputs and try again.";
    
    // Check for revert reason in error details
    if (error.error?.message) {
      const errorDetails = error.error.message;
      if (errorDetails.includes("Already voted")) {
        errorMessage = "You have already voted on this poll.";
      } else if (errorDetails.includes("Poll does not exist") || errorDetails.includes("not active")) {
        errorMessage = "Poll does not exist or is not active.";
      } else if (errorDetails.includes("Poll has expired") || errorDetails.includes("expired")) {
        errorMessage = "Poll has expired.";
      } else if (errorDetails.includes("reverted with reason string")) {
        // Extract the revert reason
        const match = errorDetails.match(/reverted with reason string '([^']+)'/);
        if (match) {
          errorMessage = match[1];
        }
      }
    } else if (error.reason) {
      errorMessage = error.reason;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.message) {
      // Check for common error patterns in error message
      if (error.message.includes("Already voted")) {
        errorMessage = "You have already voted on this poll.";
      } else if (error.message.includes("Poll does not exist")) {
        errorMessage = "Poll does not exist or is not active.";
      } else if (error.message.includes("Poll has expired")) {
        errorMessage = "Poll has expired.";
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(errorMessage);
  }
}

// End a poll (after expiration)
export async function endPollTx(
  signer: ethers.Signer,
  pollId: number,
  chainId?: number
): Promise<ethers.ContractTransactionResponse> {
  const contract = getContract(signer, chainId);
  return await contract.endPoll(pollId) as Promise<ethers.ContractTransactionResponse>;
}

// Get all polls
export async function getAllPolls(provider: ethers.Provider, chainId?: number): Promise<Poll[]> {
  try {
    const contractAddress = getContractAddress(chainId);
    // First, check if contract exists at the address
    const code = await provider.getCode(contractAddress);
    if (code === "0x" || code === "0x0") {
      throw new Error(`Contract not found at address ${contractAddress}. Please deploy the contract first.`);
    }

    const contract = getContractReadOnly(provider, chainId);
    
    // Try to get poll count with better error handling
    let pollCount: bigint;
    try {
      pollCount = await contract.getPollCount();
    } catch (error: any) {
      // If getPollCount fails, the contract might not be properly deployed
      if (error.message?.includes("BAD_DATA") || error.message?.includes("could not decode")) {
        throw new Error(`Contract at ${CONTRACT_ADDRESS} does not respond correctly. Please ensure the contract is deployed and the address is correct.`);
      }
      throw error;
    }

    const polls: Poll[] = [];

    for (let i = 0; i < Number(pollCount); i++) {
      try {
        const poll = await contract.getPoll(i);
        polls.push({
          id: i,
          title: poll.title,
          description: poll.description,
          options: poll.options,
          expireAt: poll.expireAt,
          creator: poll.creator,
          isActive: poll.isActive,
        });
      } catch (error) {
        console.error(`Error fetching poll ${i}:`, error);
      }
    }

    return polls;
  } catch (error: any) {
    console.error("Error in getAllPolls:", error);
    throw error;
  }
}

// Get encrypted vote count for an option
export async function getEncryptedVoteCount(
  provider: ethers.Provider,
  pollId: number,
  optionIndex: number,
  chainId?: number
): Promise<string> {
  const contract = getContractReadOnly(provider, chainId);
  const encryptedCount = await contract.getEncryptedVoteCount(pollId, optionIndex);
  return encryptedCount;
}

// Check if user has voted
export async function hasUserVoted(
  provider: ethers.Provider,
  pollId: number,
  userAddress: string,
  chainId?: number
): Promise<boolean> {
  const contract = getContractReadOnly(provider, chainId);
  return contract.hasVoted(pollId, userAddress);
}

