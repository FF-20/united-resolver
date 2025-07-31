# Unite Cross-Chain Resolver

A high-performance resolver backend for atomic cross-chain swaps between EVM and Cosmos ecosystems.

## Overview

This resolver monitors cross-chain orders from the Unite frontend, analyzes their profitability, and executes atomic swaps using escrow contracts on both source and destination chains.

### Key Features

- **Cross-Chain Support**: EVM ↔ Cosmos atomic swaps
- **Profitability Analysis**: Real-time pricing and gas cost analysis
- **Atomic Guarantees**: Hash time-locked contracts (HTLCs) ensure trustless execution
- **MEV Protection**: Advanced routing to protect against front-running
- **High Performance**: Processes orders in under 2 seconds
- **Comprehensive Monitoring**: Full order lifecycle tracking

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Unite Frontend │    │  Resolver API   │    │  Order Monitor  │
│                 │────┤                 │────┤                 │
│ Creates Orders  │    │  Receives Orders│    │ Fetches Pending │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Profitability   │
                       │ Analyzer        │
                       │                 │
                       │ • Price feeds   │
                       │ • Gas estimates │
                       │ • Liquidity     │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Escrow Executor │
                       │                 │
                       │ • Source Lock   │
                       │ • Dest Lock     │
                       │ • Secret Reveal │
                       │ • Claim Funds   │
                       └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- TypeScript
- Ethereum wallet with testnet ETH
- Cosmos wallet with testnet ATOM

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Build and run
npm run build
npm start

# Or run in development mode
npm run dev
```

### Configuration

Edit `.env` with your settings:

```env
# Essential Configuration
RESOLVER_PRIVATE_KEY=your_ethereum_private_key
COSMOS_MNEMONIC=your_cosmos_mnemonic_phrase
FRONTEND_URL=http://localhost:3000

# Profitability Thresholds
MIN_PROFIT_USD=5.0
MIN_PROFIT_MARGIN=0.5
```

## API Endpoints

### Submit Order
```http
POST /api/orders
Content-Type: application/json

{
  "orderHash": "0x123...",
  "maker": "0xabc...",
  "srcChainId": 11155111,
  "dstChainId": "cosmoshub-4",
  "srcToken": "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
  "dstToken": "uatom",
  "srcAmount": "1.0",
  "dstAmount": "25.5",
  "deadline": 1703097600000,
  "secretHash": "0xdef...",
  "signature": "0x456..."
}
```

### Check Order Status
```http
GET /api/orders/{orderHash}
```

### Resolver Stats
```http
GET /api/resolver/stats
```

## Atomic Swap Process

### 1. Order Analysis
- Fetch real-time token prices from CoinGecko
- Estimate gas costs on both chains
- Calculate profitability and margins
- Check liquidity availability

### 2. Escrow Execution
```typescript
// Source Chain (Ethereum)
await escrowContract.lockFunds(
  secretHash,     // Same hash for both chains
  tokenAddress,   // User's token
  amount,         // User's amount
  timelock,       // 2-hour timeout
  resolverAddress // Who can claim
);

// Destination Chain (Cosmos)
await cosmosClient.signAndBroadcast([{
  typeUrl: '/ibc.applications.htlc.v1.MsgCreateHTLC',
  value: {
    sender: resolverAddress,
    to: userAddress,
    recipientOnOtherChain: userAddress,
    amount: [{ denom: 'uatom', amount: destinationAmount }],
    hashLock: secretHash,
    timeLock: timelock
  }
}]);
```

### 3. Secret Reveal
- Both escrows are locked with same secret hash
- Resolver reveals secret to claim user's tokens
- User can now claim resolver's tokens using revealed secret
- Atomic guarantee: either both succeed or both fail

## Supported Chains

### Source Chains (EVM)
- Ethereum Mainnet (1)
- Ethereum Sepolia (11155111) 
- BSC Mainnet (56)

### Destination Chains (Cosmos)
- Cosmos Hub (cosmoshub-4)
- Osmosis (osmosis-1)

## Profitability Analysis

The resolver uses multiple factors to determine if an order is profitable:

1. **Token Prices**: Real-time prices from CoinGecko
2. **Gas Costs**: Dynamic estimation based on network conditions  
3. **Bridge Fees**: Protocol-specific bridge costs
4. **Slippage**: Price impact analysis
5. **Opportunity Cost**: Capital efficiency calculations

### Example Analysis
```
Order: 1 ETH ($2,500) → 62.5 ATOM ($2,500)
- Gas Costs: $8 (Ethereum) + $0.50 (Cosmos)
- Bridge Fees: $2
- Gross Profit: $0 (market rate)
- Net Loss: $10.50
❌ Order rejected: Insufficient profit
```

## Error Handling

### Timeout Scenarios
- **Source Timeout**: Resolver can cancel and reclaim funds
- **Destination Timeout**: User can cancel and reclaim funds
- **Both Timeout**: Funds automatically returned to original owners

### Recovery Mechanisms
- Automatic retry for temporary failures
- Manual intervention endpoints for stuck orders
- Comprehensive logging for post-mortem analysis

## Monitoring & Alerts

### Health Checks
```bash
curl http://localhost:3001/health
```

### Key Metrics
- Orders processed per hour
- Success/failure rates
- Average execution time
- Profit margins
- Gas cost efficiency

### Logging
- Structured JSON logs
- Separate error logs
- Log rotation (5MB files, 5 files retained)
- Real-time monitoring integration

## Security

### Private Key Management
- Environment variable configuration
- Hardware wallet support (future)
- Multi-signature support (future)

### Order Validation
- Signature verification
- Deadline checks
- Amount validation
- Chain compatibility

### Rate Limiting
- Order submission limits
- API rate limiting
- DDoS protection

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
src/
├── resolver/           # Main resolver orchestration
├── services/          # Core business logic
│   ├── OrderMonitor.ts
│   ├── ProfitabilityAnalyzer.ts
│   └── EscrowExecutor.ts
├── routes/            # API endpoints
├── types/             # TypeScript definitions
└── utils/             # Utilities and helpers
```

### Adding New Chains

1. Update `supportedChains` in configuration
2. Add RPC endpoints to `.env`
3. Implement chain-specific escrow logic
4. Add price feed mappings
5. Update gas estimation logic

## Production Deployment

### Infrastructure Requirements
- 4 GB RAM minimum
- 50 GB SSD storage
- Reliable internet connection
- 99.9% uptime requirement

### Monitoring Setup
- Prometheus metrics export
- Grafana dashboards
- PagerDuty alerts
- Discord/Slack notifications

### Scaling Considerations
- Horizontal scaling with load balancer
- Database for order persistence
- Redis for caching
- Message queue for high throughput

## Troubleshooting

### Common Issues

**Orders not being processed**
- Check frontend connectivity
- Verify RPC endpoints
- Check private key permissions

**High gas costs**
- Adjust MAX_GAS_PRICE_GWEI
- Monitor network congestion
- Consider gas optimization

**Cosmos transactions failing**
- Verify mnemonic phrase
- Check ATOM balance for fees
- Confirm RPC endpoint health

## Contributing

1. Fork the repository
2. Create feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit pull request

## License

MIT License - see LICENSE file for details. 