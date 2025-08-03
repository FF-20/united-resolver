import { ethers } from 'ethers';
import axios from 'axios';
import { createLogger } from '../utils/logger';
import { provider } from './provider';
import { chains, ChainId } from '../resolver/config';
import { wallet } from './wallet';
import { contract } from './contract';
import { fillOrderArgs, Swap } from '../types';
import { Immutables } from '@1inch/cross-chain-sdk';
import { time } from 'console';

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

const ESCROW_FACTORY_ABI = [
  "constructor(address limitOrderProtocol, address feeToken, address accessToken, address owner, uint32 rescueDelaySrc, uint32 rescueDelayDst)",

  "function ESCROW_DST_IMPLEMENTATION() view returns (address)",

  "function ESCROW_SRC_IMPLEMENTATION() view returns (address)",

  "function FEE_BANK() view returns (address)",

  "function addressOfEscrowDst((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256)) view returns (address)",

  "function addressOfEscrowSrc((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256)) view returns (address)",

  "function availableCredit(address) view returns (uint256)",

  "function createDstEscrow((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256), uint256) payable",

  "function decreaseAvailableCredit(address, uint256) returns (uint256)",

  "function getMakingAmount((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes, bytes32, address, uint256, uint256, bytes) view returns (uint256)",

  "function getTakingAmount((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes, bytes32, address, uint256, uint256, bytes) view returns (uint256)",

  "function increaseAvailableCredit(address, uint256) returns (uint256)",

  "function lastValidated(bytes32) view returns (uint256, bytes32)",

  "function postInteraction((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes, bytes32, address, uint256, uint256, uint256, bytes)",

  "function preInteraction((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes, bytes32, address, uint256, uint256, uint256, bytes)",

  "function takerInteraction((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes, bytes32, address, uint256, uint256, uint256, bytes)"
];

export class Resolver {
  private readonly relayerAPI = process.env.RELAYER_URL;
  private processedOrders = new Set<string>();
  private activeSwaps = new Map<string, Swap>();
  private evmResolverContract = new ethers.Contract(process.env.RESOLVER_CONTRACT_ADDRESS!, RESOLVER_ABI);
  private evmFactoryContract = new ethers.Contract(process.env.FACTORY_CONTRACT_ADDRESS!, ESCROW_FACTORY_ABI)
  
  constructor(
    privateKey: Map<number | string, string>,
  ) {
    for (const chainId of Object.keys(chains) as ChainId[]) {
      provider.getProvider(chainId)
      wallet.getWallet(chainId)
      contract.getContract(chainId)
    }
  }

  async processOrders(orderArgs: fillOrderArgs, chainId: ChainId): Promise<void> {
    // fill order
    await this.createSrcEscrow(orderArgs);

    // Calculate srcescrow
    // Listen to creation event and calculate the contract address
    this.evmFactoryContract.on('SrcEscrowCreated', async (immutables: any, immutablesComplement: any, event: any) => {
      const escrowAddress = this.evmFactoryContract.addressOfEscrowSrc()
    });

    // add order to monitor
    const swap: Swap = {
      immutables: orderArgs.immutables,
      srcEscrow: "",
      dstEscrow: "",
      chainId: chainId,
      status: 'active',
      createdAt: Date.now(),
    }
    this.addSwapOrder(swap);
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
    try {
      logger.info('Starting maker asset withdrawal process');
      
      // Get all active swaps that need withdrawal
      const swapsToWithdraw = Array.from(this.activeSwaps.values())
        .filter(swap => swap.status === 'active');
      
      for (const swap of swapsToWithdraw) {
        try {
          // Check if withdrawal is possible (time has passed)
          const currentTime = Math.floor(Date.now() / 1000);
          const withdrawalTime = swap.immutables.timelocks.srcWithdrawal;
          
          if (currentTime < withdrawalTime) {
            logger.info(`Withdrawal not yet available for swap ${swap.immutables.hashlock}. Waiting until ${withdrawalTime}`);
            continue;
          }

          const secret = "0x0000000000000000000000000000000000000000000000000000000000000000"; // Placeholder
          
          logger.info(`Withdrawing maker asset for swap ${swap.immutables.hashlock}`);
          
          // Call the existing withdraw function
          await this.withdraw(swap.srcEscrow, secret, swap.immutables);
          
          // Update swap status
          swap.status = 'completed';
          swap.updateAt = Date.now();
          
          // Remove from active tracking
          this.removeSwapFromTracking(swap.immutables.hashlock);
          
        } catch (error) {
          logger.error(`Failed to withdraw maker asset for swap ${swap.immutables.hashlock}:`, 
            error instanceof Error ? error.message : String(error));
        }
      }
      
    } catch (error) {
      logger.error('Error in withdrawMakerAsset:', error instanceof Error ? error.message : String(error));
    }
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

      const tx = await this.evmResolverContract.deploySrc(order);

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


  private async createSrcEscrow(orderArgs: fillOrderArgs) {
    const tx = await this.evmResolverContract.deploySrc(orderArgs.immutables, orderArgs.order, orderArgs.signature.r, orderArgs.signature.vs, orderArgs.amount, orderArgs.args);

    logger.info(`Sepolia transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();

    logger.info('Order executed successfully on Sepolia', {
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    });

  }

  private async createDstEscrow(immutables: Immutables, srcCancellationTimestamp: string) {
    const tx = await this.evmResolverContract.deployDst(immutables, srcCancellationTimestamp);

    logger.info(`Sepolia transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();

    logger.info('Order executed successfully on Sepolia', {
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber
    });
  }

  private async withdraw(escrowAddress: string, secret: string, immutables: Immutables) {
      const tx = await this.evmResolverContract.withdraw(escrowAddress, secret);

      logger.info(`Sepolia transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();

      logger.info('Order executed successfully on Sepolia', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      });
  }

  private async cancel(escrowAddress: string, immutables: Immutables) {
      const tx = await this.evmResolverContract.cancel(escrowAddress, immutables);

      logger.info(`Sepolia transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();

      logger.info('Order executed successfully on Sepolia', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      });
  }

  
} 