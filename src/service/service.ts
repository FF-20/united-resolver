import { Resolver } from "../resolver/resolver"
import { fillOrderArgs } from "../types";
import OrderMonitorService from "./orderMonitorService";

class Service {
    private resolver: Resolver;
    private orderMonitor: OrderMonitorService;

    constructor() {
        const privateKeys = new Map <number | string, string> ([
            [11155111, process.env.SEPOLIA_PRIVATE_KEY!],
            ['pion-1', process.env.COSMOS_MNEMONIC!]
          ]);
      
        this.resolver = new Resolver(
            privateKeys
        )
        this.orderMonitor = new OrderMonitorService()
    }

    async handleOrder(orderArgs: fillOrderArgs): Promise<void> {
        // validate order
        if (!orderArgs.order || !orderArgs.signature) {
            throw new Error("Invalid order structure");
        }

        // process the order
        this.resolver.processOrders()
    }

    async handleSecret(secret: string, srcEscrow: string, dstEscrow: string): Promise<void> {

    }
}

export default Service