# 🔐 Secret Vote Box - Encrypted Voting System

A decentralized voting application built with **FHEVM (Fully Homomorphic Encryption Virtual Machine)** that enables encrypted voting on the blockchain. Votes remain encrypted until polls close, ensuring privacy and preventing trend-following.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)
![Solidity](https://img.shields.io/badge/solidity-^0.8.0-orange.svg)

## ✨ Features

- 🔒 **Encrypted Voting**: Votes are encrypted using FHEVM until polls close
- 🌐 **Multi-Network Support**: Supports both localhost (Hardhat) and Sepolia testnet
- 💼 **Wallet Integration**: Connect using RainbowKit with multiple wallet options
- 🔐 **Privacy-First**: Vote counts are encrypted and cannot be viewed until poll expiration
- 🚀 **Decentralized**: No central authority controls the voting process
- 📊 **Real-time Updates**: View active polls and vote counts in real-time
- 🎯 **User-Friendly**: Intuitive UI built with React and Tailwind CSS

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity** ^0.8.0
- **FHEVM** - Fully Homomorphic Encryption Virtual Machine
- **Hardhat** - Development environment
- **Ethers.js** ^6.15.0 - Ethereum library

### Frontend
- **React** ^18.3.1 - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **RainbowKit** - Wallet connection
- **Wagmi** - React Hooks for Ethereum
- **Viem** - TypeScript Ethereum library
- **@zama-fhe/relayer-sdk** - FHEVM SDK

## 📁 Project Structure

```
fhevm-hardhat-template/
├── contracts/
│   └── SecretVoteBox.sol      # Main voting contract with FHEVM
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

3. **Contract Address**: The contract will be deployed at:
   - `0x5FbDB2315678afecb367f032d93F642f64180aa3` (default Hardhat address)

### Sepolia Testnet

1. **Set up environment variables**
```bash
npx hardhat vars setup
```

2. **Configure your private key and Infura API key**
   - Set `PRIVATE_KEY` in your environment
   - Set `INFURA_API_KEY` in your environment

3. **Deploy to Sepolia**
```bash
npx hardhat deploy --network sepolia
```

4. **Deployed Contract Address on Sepolia**:
   - `0x638A70A2901fD2e644EC3625B7674A25ceB33c59`

## 🌐 Network Configuration

The application supports multiple networks with automatic contract address selection:

| Network | Chain ID | Contract Address |
|---------|----------|------------------|
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
   - Click "Connect Wallet" in the top right
   - Select your preferred wallet (MetaMask, Rainbow, etc.)
   - Ensure you're connected to the correct network (localhost or Sepolia)

## 📖 Usage Guide

### Creating a Poll

1. **Navigate to "Create Poll"**
2. **Fill in poll details**:
   - Title: The poll question
   - Description: Additional context
   - Options: At least 2 voting options
   - Expiration: When the poll should close (minimum 5 minutes from now)
3. **Click "Create Poll"** and confirm the transaction in your wallet

### Voting

1. **Browse active polls** on the home page
2. **Click on an option** to cast your encrypted vote
3. **Confirm the transaction** in your wallet
4. Your vote is encrypted and cannot be viewed until the poll expires

### Viewing Results

- **Active polls**: Vote counts are encrypted and not visible
- **Expired polls**: Vote counts can be decrypted and viewed
- **My Votes**: View all polls you've voted on

## 🔧 Smart Contract Functions

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
Returns the encrypted vote count for a specific option.

### `hasVoted(pollId, voter)`
Checks if a specific address has voted on a poll.

### `getPollCount()`
Returns the total number of polls created.

### `endPoll(pollId)`
Ends a poll (can be called by the poll creator).

## 🔐 FHEVM Configuration

The application uses Zama's FHEVM for encrypted operations:

### Sepolia Testnet FHEVM Contracts
- **ACL Contract**: `0x687820221192C5B662b25367F70076A37bc79b6c`
- **KMS Verifier**: `0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC`
- **Input Verifier**: `0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4`
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
