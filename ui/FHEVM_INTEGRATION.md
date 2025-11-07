# FHEVM SDK Integration Guide

## Overview

The frontend now uses `@fhevm/sdk` to encrypt vote data before submitting to the smart contract. This ensures that votes remain private until polls close.

## Implementation Details

### 1. FHEVM Instance Initialization

The FHEVM instance is initialized in `src/lib/fhevm.ts`:

```typescript
import { FhevmInstance, createFhevmInstance } from "@fhevm/sdk";

export async function getFHEVMInstance(provider: ethers.Provider): Promise<FhevmInstance> {
  return initializeFHEVM(provider);
}
```

### 2. Encrypting Vote Data

When a user votes, the option index is encrypted using:

```typescript
const encryptedInput = await encryptOptionIndex(
  fhevm,
  CONTRACT_ADDRESS,
  userAddress,
  optionIndex
);
```

This creates an encrypted input with:
- `handles[0]`: The encrypted handle to pass to the contract
- `inputProof`: The proof required by the contract

### 3. Submitting Encrypted Vote

The encrypted vote is submitted to the contract:

```typescript
const tx = await castVote(
  signer,
  pollId,
  encryptedInput.handles[0],
  encryptedInput.inputProof
);
```

### 4. Decrypting Vote Counts

To decrypt vote counts (after poll expiration):

```typescript
const decryptedCount = await decryptVoteCount(
  fhevm,
  encryptedValue,
  contractAddress,
  signer
);
```

## Usage Flow

1. User connects wallet
2. User selects a voting option
3. Frontend encrypts the option index using FHEVM SDK
4. Encrypted vote is submitted to the contract
5. Contract stores encrypted vote count
6. After poll expiration, vote counts can be decrypted

## Important Notes

- The FHEVM instance must be initialized with the same provider used for contract interactions
- Encryption requires the contract address and user address
- The encrypted handle and proof must be passed together to the contract
- Vote counts remain encrypted until decrypted by authorized users

## Error Handling

The implementation includes error handling for:
- Missing wallet connection
- Missing contract address
- Encryption failures
- Transaction failures

All errors are displayed to the user via toast notifications.

