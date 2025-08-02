import { ethers } from 'ethers';

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

// // Example function signature for calling fillOrder on a contract instance
// async function fillOrder(
//   contract: ethers.Contract,
//   order: Order,
//   signature: { r: string; vs: string },
//   amount: string, // uint256
//   takerTraits: TakerTraits,
//   args: string // bytes calldata
// ): Promise<ethers.TransactionResponse> {
  
//   // The order struct is often passed as an array/tuple in ethers.js
//   const orderTuple = [
//     order.salt,
//     order.maker,
//     order.receiver,
//     order.makerAsset,
//     order.takerAsset,
//     order.makingAmount,
//     order.takingAmount,
//     order.makerTraits,
//   ];

//   // The actual contract call
//   return contract.fillOrder(
//     orderTuple,
//     signature.r,
//     signature.vs,
//     amount,
//     takerTraits,
//     args
//   );
// }