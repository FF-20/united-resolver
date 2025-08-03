export interface CrossChainOrder {
  orderHash: string;
  maker: string;
  srcChainId: string | number;
  dstChainId: string | number;
  srcToken: string;
  dstToken: string;
  srcAmount: string;
  dstAmount: string;
  deadline: number;
  secretHash: string;
  signature: string;
  escrowFactory?: string;
  timeLocks?: TimeLocks;
  createdAt?: number;
  nonce?: string;
  
  // Resolver-specific fields
  status: OrderStatus;
  estimatedGasCost: string;
  profitability: number | null;
}

export interface TimeLocks {
  srcWithdrawal: number;
  srcPublicWithdrawal: number;
  srcCancellation: number;
  srcPublicCancellation: number;
  dstWithdrawal: number;
  dstPublicWithdrawal: number;
  dstCancellation: number;
}

export type OrderStatus = 'pending' | 'analyzing' | 'executing' | 'completed' | 'failed' | 'expired';

export interface ResolverDecision {
  orderHash: string;
  shouldFill: boolean;
  reason: string;
  expectedProfitUsd: number;
  profitMarginPercent: number;
  estimatedGasCost: number;
  srcTokenPrice?: TokenPrice;
  dstTokenPrice?: TokenPrice;
  liquidityStatus?: LiquidityStatus;
  optimalRoute?: string;
  analysisTimeMs: number;
  timestamp: number;
}

export interface TokenPrice {
  priceUsd: number;
  source: 'cache' | 'api' | 'fallback';
  timestamp?: number;
}

export interface GasEstimate {
  sourceGasUnits: number;
  sourceGasPrice: string;
  sourceGasUsd: number;
  destinationGasUnits: number;
  destinationGasPrice: string;
  destinationGasUsd: number;
  claimGasUnits: number;
  claimGasUsd: number;
  totalGasUsd: number;
}

export interface LiquidityStatus {
  hasSourceLiquidity: boolean;
  hasDestinationLiquidity: boolean;
  liquidityRatio: number;
  estimatedSlippage: number;
}

export interface TransactionResult {
  hash: string;
  chainId: string;
  blockNumber: number;
  gasUsed: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface ResolverConfig {
  minProfitUsd: number;
  minProfitMargin: number;
  maxGasPrice: string;
  supportedChains: (string | number)[];
  escrowContracts: Record<string, string>;
  rpcEndpoints: Record<string, string>;
}

export interface ResolverStats {
  totalOrdersProcessed: number;
  successfulFills: number;
  failedFills: number;
  totalProfitUsd: number;
  averageExecutionTime: number;
  currentBalance: Record<string, string>;
}

// API Response types
export interface OrderSubmissionResponse {
  success: boolean;
  message: string;
  orderHash?: string;
  estimatedFillTime?: number;
}

export interface OrderStatusResponse {
  orderHash: string;
  status: OrderStatus;
  progress: {
    step: string;
    completed: boolean;
    timestamp: number;
  }[];
  estimatedCompletion?: number;
  transactionHashes?: {
    sourceEscrow?: string;
    destinationEscrow?: string;
    claim?: string;
  };
}

export type MakerTraits = string; // e.g., '0' for uint256

export type TakerTraits = string; // e.g., '0' for uint256

// Interface for the main order structure
export interface Order {
  salt: string;          
  maker: string;         
  receiver: string;      
  makerAsset: string;    
  takerAsset: string;    
  makingAmount: string;  
  takingAmount: string;  
  makerTraits: MakerTraits; // 0 by default
}

export interface Timelocks {
    srcWithdrawal: number,       
    srcPublicWithdrawal: number, 
    srcCancellation: number,     
    srcPublicCancellation: number, 
    dstWithdrawal: number,       
    dstPublicWithdrawal: number, 
    dstCancellation: number      
}


// Interface for the Immutables structure
export interface Immutables {
  orderHash: string;     
  hashlock: string;      
  maker: string;         
  taker: string;         
  token: string;         
  amount: string;        
  safetyDeposit: string; 
  timelocks: Timelocks;
}

export interface Signature {
    r: string;
    vs: string;
}

export interface fillOrderArgs {
    order: Order,
    immutables: Immutables,
    signature: Signature,
    amount: string,
    takerTraits: TakerTraits, // we can omit this which set to zero
    args: string // for post interaction
}

export interface Swap {
    immutables: Immutables,
    srcEscrow: string,
    dstEscrow: string,
    chainId: number | string,
    status: 'active' | 'completed'
    createdAt: number,
    updateAt?: number
}