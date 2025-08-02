import { ethers } from 'ethers';
import axios from 'axios';
import { createLogger } from '../utils/logger';
import { provider } from './provider';
import { chains, ChainId } from '../resolver/config';
import { wallet } from './wallet';
import { contract } from './contract';
import { fillOrderArgs, Swap } from '../types';
import { Immutables } from '@1inch/cross-chain-sdk';

const logger = createLogger('Resolver');

interface Order {
  salt: string;
  makerAsset: string;
  takerAsset: string;
  maker: string;
  receiver: string;
  allowedSender: string;
  makingAmount: string;
  takingAmount: string;
  offsets: string;
  interactions: string;
  signature: string;
}

const RESOLVER_ABI = [
  "constructor(address factory, address lop, address initialOwner)",

  "function deploySrc((address,bytes32,address,address,address,uint256,uint256,(uint256,uint256,uint256,uint256,uint256)) immutables, (uint256,uint256,address,address,address,address,bytes,bytes) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits, bytes args)",

  "function deployDst((address,bytes32,address,address,address,uint256,uint256,(uint256,uint256,uint256,uint256,uint256)) dstImmutables, uint256 srcCancellationTimestamp)",

  "function withdraw(address escrow, bytes32 secret, (address,bytes32,address,address,address,uint256,uint256,(uint256,uint256,uint256,uint256,uint256)) immutables)",

  "function cancel(address escrow, (address,bytes32,address,address,address,uint256,uint256,(uint256,uint256,uint256,uint256,uint256)) immutables)",

  "function arbitraryCalls(address[] targets, bytes[] arguments)"
];

export class Resolver {
  private readonly relayerAPI = process.env.RELAYER_URL;
  private processedOrders = new Set<string>();
  private activeSwaps = new Map<string, Swap>();
  
  constructor(
    privateKey: Map<number | string, string>,
  ) {
    for (const chainId of Object.keys(chains) as ChainId[]) {
      provider.getProvider(chainId)
      wallet.getWallet(chainId)
      contract.getContract(chainId)
    }
  }

  async processOrders(): Promise<void> {
    // fill order
    // add order to monitor

  }

  async checkAndHandleTimeout() {
    // Check through all swap that are in active swap
    const now = Math.floor(Date.now() / 1000);
    logger.info(`Checking ${this.activeSwaps.size} active swaps for timeouts...`);

    // Loop through all active entries
    for (const [hashlock, swap] of this.activeSwaps) {
      if(now > swap.immutables.timelocks.srcCancellation) {
        try{
          this.cancelSwapOnSource()
          this.removeSwapFromTracking(hashlock);
          logger.info(`Cancelled source chain swap ${hashlock}`)
        } catch (err) {
          logger.error(`Failed to cancel source chain swap ${err}`)
        }
      }

      if(now > swap.immutables.timelocks.dstCancellation) {
        try {
          this.cancelSwapOnDestination()
          this.removeSwapFromTracking(hashlock);
          logger.info(`Cancelled destination chain swap ${hashlock}`)
        } catch (err) {
          logger.error(`Failed to cancel destination chain swap ${err}`)
        }
      }
    }
  }
  
  async withdrawMakerAsset() {

  }
  
  async withdrawTakerAsset() {
    
  }

  async cancelSwapOnSource() {

  }

  async cancelSwapOnDestination() {
    
  }
  
  private addSwapOrder(swap: Swap): void {
    this.activeSwaps.set(swap.immutables.hashlock, swap);
    logger.info(`Added swap ${swap.immutables.hashlock} to tracking.`)
  }

  private removeSwapFromTracking(hashlock: string): void {
    this.activeSwaps.delete(hashlock);
    logger.info(`Removed swap ${hashlock} from tracking`);
  }
  private async fillOrder(order: fillOrderArgs, chainId: ChainId): Promise<void> {
    try {
      logger.info('Executing order on Sepolia', {
        userGives: `${order.order.makingAmount} ${order.order.makerAsset}`,
        userGets: `${order.order.takingAmount} ${order.order.takerAsset}`
      });

      const _contract = contract.getContract(chainId)
      const tx = await contract.deploySrc(order);

      logger.info(`Sepolia transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      logger.info('Order executed successfully on Sepolia', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      });

    } catch (error) {
      logger.error(`Failed to execute order ${order.salt.slice(0, 10)} on Sepolia:`, error instanceof Error ? error.message : String(error));
    }
  }


  async createDstEscrow(immutables: Immutables, srcCancellationTimestamp: string) {

  }

  private async withdraw(escrowAddress: string, secret: string, immutables: Immutables) {

  }

  private async cancel(escrowAddress: string, immutables: Immutables) {

  }

  
} 