# Troubleshooting Guide

## WalletConnect 403 Errors

If you see 403 errors in the console related to WalletConnect:

```
POST https://pulse.walletconnect.org/e?projectId=... 403 (Forbidden)
GET https://api.web3modal.org/appkit/v1/config?projectId=... 403 (Forbidden)
```

**These errors are expected for localhost development and can be safely ignored.**

### Why this happens:
- WalletConnect requires a valid projectId registered at https://cloud.reown.com
- The projectId must have your localhost origin whitelisted
- For local development, these remote config requests will fail

### Solutions:

1. **Ignore the errors (Recommended for localhost)**
   - These errors don't affect functionality
   - Wallet connection will still work with MetaMask and other injected wallets
   - Only WalletConnect mobile app connections require the remote config

2. **Get a real projectId (For production)**
   - Register at https://cloud.reown.com
   - Create a new project
   - Add your domain to the allowlist
   - Set `VITE_WALLET_CONNECT_PROJECT_ID` in your `.env` file

3. **Disable WalletConnect (Optional)**
   - If you only need MetaMask/local wallets, you can configure RainbowKit to skip WalletConnect
   - However, this requires custom configuration beyond `getDefaultConfig`

## Base Account SDK Warning

If you see this warning:

```
Base Account SDK requires the Cross-Origin-Opener-Policy header to not be set to 'same-origin'.
```

**This warning can be safely ignored.** It does not affect functionality.

### Why this happens:
- FHEVM SDK requires `Cross-Origin-Opener-Policy: same-origin` for WebAssembly SharedArrayBuffer
- Base Account SDK prefers a different CORS policy
- These are conflicting requirements, but FHEVM takes priority

### Solution:
- **Ignore the warning** - It does not prevent Base Account or FHEVM from working
- FHEVM functionality will work correctly
- Wallet connections will work correctly

## FHEVM SDK Errors

If you see errors related to `@fhevm/sdk`:

### "global is not defined"
- **Fixed**: Added Node.js polyfills in `vite.config.ts`
- If still seeing this, clear Vite cache: `rm -rf node_modules/.vite`

### "util module not found"
- **Fixed**: Added `util` polyfill in `vite.config.ts`
- Restart dev server after changes

### FHEVM Instance Creation Fails
- Ensure Hardhat node is running on `http://localhost:8545`
- Check that FHEVM network contracts are deployed
- For localhost, you may need to configure FHEVM contract addresses
- Ensure `window.ethereum` is available (MetaMask or another Web3 wallet)

## Port Already in Use

If you see `EADDRINUSE: address already in use 127.0.0.1:8545`:

1. Find the process using port 8545:
   ```bash
   netstat -ano | findstr :8545
   ```

2. Kill the process (replace PID with actual process ID):
   ```bash
   taskkill /PID <PID> /F
   ```

3. Or use a different port in `hardhat.config.ts`

## Contract Address Not Set

If you see "Contract address not set" errors:

1. Deploy the contract:
   ```bash
   npx hardhat deploy --network localhost
   ```

2. Copy the deployed address from the output

3. Create `.env` file in `ui/` directory:
   ```
   VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
   ```

4. Restart the dev server

