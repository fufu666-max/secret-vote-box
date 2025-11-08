# 🗳️ Community Voting - Governance DApp

A community governance voting dApp. Built on **FHEVM (Fully Homomorphic Encryption Virtual Machine)**, it keeps every voter’s choice and the total vote count encrypted while the poll is active. After the poll ends, on-chain decryption reveals each option’s count and percentage to everyone, without exposing voter identities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)
![Solidity](https://img.shields.io/badge/solidity-^0.8.0-orange.svg)

## ✨ Features (Community/DAO)

- 🔒 Privacy-first: during voting, individual choices and the total count are encrypted to prevent trend-following
- 🔓 Post-expiry disclosure: after the poll ends, on-chain decryption reveals per-option counts and percentages (never identities)
- 🌐 Multi-network support: Local Hardhat and Sepolia testnet
- 💼 Wallet integration: RainbowKit/Wagmi for easy wallet connections
- 🚀 Fully decentralized: data and computation are on-chain, no central database
- 🧭 Community-friendly: ideal for DAO proposals, community feedback, and governance polls

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity** ^0.8.0
- **FHEVM** - Fully Homomorphic Encryption Virtual Machine
- **Hardhat** - Development environment
- **Ethers.js** ^6.15.0 - Ethereum library

### Frontend
- **React** ^18.3.1
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **RainbowKit** - Wallet connection
- **Wagmi / Viem** - Ethereum Hooks/TS libs
- **@zama-fhe/relayer-sdk** - FHEVM SDK

## 📁 Project Structure

```
fhevm-hardhat-template/
├── contracts/
│   └── SecretVoteBox.sol      # Core voting contract (FHE homomorphic counting)
├── test/
│   ├── SecretVoteBox.ts       # Local network tests
│   └── SecretVoteBoxSepolia.ts # Sepolia testnet tests
├── deploy/
│   └── deploy.ts              # Deployment script
├── deployments/
│   ├── localhost/             # Local deployment artifacts
│   └── sepolia/               # Sepolia deployment artifacts
├── ui/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Header.tsx     # Navigation header
│   │   │   ├── PollCard.tsx   # Poll display card
│   │   │   └── WalletButton.tsx # Wallet connection
│   │   ├── pages/             # Page components
│   │   │   ├── Index.tsx      # Home page (polls list)
│   │   │   ├── CreatePoll.tsx # Create poll page
│   │   │   └── MyVotes.tsx    # User votes page
│   │   └── lib/               # Utilities
│   │       ├── contract.ts    # Contract interaction
│   │       ├── fhevm.ts       # FHEVM encryption/decryption
│   │       └── wagmi.ts       # Wagmi configuration
│   └── public/                # Static assets
└── hardhat.config.ts          # Hardhat configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** >= 7.0.0 or **pnpm**
- A Web3 wallet (MetaMask, Rainbow, etc.)
- Testnet ETH (for Sepolia deployment)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Simona8886/secret-vote-box.git
cd secret-vote-box
```

2. **Install contract dependencies**
```bash
npm install
```

3. **Install UI dependencies**
```bash
cd ui
npm install
# or
pnpm install
```

## 📦 Contract Deployment

### Local Network (Hardhat)

1. **Start a local Hardhat node**
```bash
npx hardhat node
```

2. **Deploy the contract** (in another terminal)
```bash
npx hardhat deploy --network localhost
```

3. **Contract Address (local)**:
   - `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Sepolia Testnet

1. **Set up environment variables**
```bash
npx hardhat vars setup
```

2. **Configure your private key and Infura API key**
   - Set `PRIVATE_KEY`
   - Set `INFURA_API_KEY`

3. **Deploy to Sepolia**
```bash
npx hardhat deploy --network sepolia
```

4. **Deployed Contract Address on Sepolia**:


## 🌐 Network Configuration

The application automatically selects the contract address based on the current network:

| Network | Chain ID | Contract Address |
|--------|----------|------------------|
| Localhost (Hardhat) | 31337 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Sepolia Testnet | 11155111 | `0x638A70A2901fD2e644EC3625B7674A25ceB33c59` |

The frontend automatically detects the current network and uses the appropriate contract address.

## 🧪 Testing

### Local Network Tests

Run tests against the local Hardhat network:
```bash
npx hardhat test
```

### Sepolia Testnet Tests

Run tests against Sepolia (requires deployed contract):
```bash
npx hardhat test --network sepolia test/SecretVoteBoxSepolia.ts
```

## 🖥️ Running the UI

1. **Navigate to the UI directory**
```bash
cd ui
```

2. **Start the development server**
```bash
npm run dev
# or
pnpm run dev
```

3. **Open your browser**
   - Navigate to `http://localhost:8080`

4. **Connect your wallet**
   - Click "Connect Wallet" (top right)
   - Select your wallet (MetaMask, Rainbow, etc.)
   - Ensure you're connected to the correct network (localhost or Sepolia)

## 📖 Usage Guide (Community Theme)

### Create a Poll (Proposal)

1. **Navigate to "Create Poll"**
2. **Fill in details**:
   - Title: poll question (e.g., “Adopt proposal X?”)
   - Description: background/context
   - Options: at least two choices
   - Expiration: end time (at least 5 minutes in the future)
3. **Click "Create Poll"**, then confirm in your wallet

### Vote

1. Browse active polls on the home page
2. Click an option and confirm the transaction
3. Your choice is encrypted on-chain and hidden until the poll ends

### View Results

- **Active**: total count and individual choices are encrypted and hidden
- **Ended**: each option’s count and percentage are publicly shown; identities are never revealed
- **My Votes**: highlights your choice locally on your device (not shared)

## 🔧 Smart Contract (Core)

### `createPoll(title, description, options, expireAt)`
Creates a new poll with the specified parameters.

**Parameters:**
- `title`: Poll title/question
- `description`: Poll description
- `options`: Array of voting options
- `expireAt`: Unix timestamp when poll expires

### `vote(pollId, encryptedOptionIndex, inputProof)`
Casts an encrypted vote for a specific option in a poll.

**Parameters:**
- `pollId`: The ID of the poll
- `encryptedOptionIndex`: Encrypted option index (bytes32)
- `inputProof`: FHEVM input proof

### `getPoll(pollId)`
Returns the poll information (title, description, options, etc.).

### `getEncryptedVoteCount(pollId, optionIndex)`
Returns the encrypted count for the given option (used for homomorphic operations while active).

### `hasVoted(pollId, voter)`
Checks if a specific address has voted on a poll.

### `getPollCount()`
Returns the total number of polls created.

### `endPoll(pollId)`
Ends a poll (callable after expiration).

### `requestFinalize(pollId)` / `getClearVoteCounts(pollId)`
After a poll ends, request on-chain decryption; once completed, retrieve per-option clear counts for percentages.

## 🔐 FHEVM Notes

This app relies on Zama FHEVM to perform homomorphic addition while data remains encrypted, preventing trend observation during voting. After expiration, results are decrypted and published.

### Sepolia Testnet FHEVM Contracts

- **Gateway Chain ID**: 55815
- **Relayer URL**: `https://relayer.testnet.zama.cloud`

### Localhost (Hardhat)
- Uses FHEVM mock utilities for local development
- Automatically fetches FHEVM metadata from Hardhat node

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](./ui/TROUBLESHOOTING.md) for common issues and solutions.

### Common Issues

1. **"Contract not found at address"**
   - Ensure you're connected to the correct network
   - Verify the contract is deployed on that network

2. **"FHEVM instance creation failed"**
   - Check your network connection
   - Ensure Hardhat node is running (for localhost)
   - Verify you're on a supported network (localhost or Sepolia)

3. **"Already voted" error**
   - Each address can only vote once per poll
   - Check if you've already voted using the "My Votes" page

4. **WalletConnect 403 errors**
   - These are expected in local development
   - They don't affect functionality
   - See TROUBLESHOOTING.md for details

## 🛡️ Security Considerations

- **Private Keys**: Never commit private keys to the repository
- **Environment Variables**: Use `.env` files for sensitive data (not committed)
- **Network Security**: Always verify contract addresses before interacting
- **Encryption**: Votes are encrypted using FHEVM, ensuring privacy

## 📝 Development Notes

- The contract uses FHEVM for encrypted operations
- Votes are encrypted using `externalEuint32` type (represented as `bytes32` in ABI)
- Vote counts can only be decrypted by users who have permission
- All data is stored on-chain, no external database required
- The frontend automatically selects the correct contract address based on `chainId`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zama](https://www.zama.ai/) for FHEVM technology
- [Hardhat](https://hardhat.org/) for the development environment
- [RainbowKit](https://www.rainbowkit.com/) for wallet integration
- [Viem](https://viem.sh/) and [Wagmi](https://wagmi.sh/) for Ethereum integration

## 📞 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/Simona8886/secret-vote-box/issues)
- Check the [TROUBLESHOOTING.md](./ui/TROUBLESHOOTING.md) guide

---

**Built with ❤️ using FHEVM**
