import { Resolver } from "../resolver/resolver";
import { createLogger } from "../utils/logger";

const logger = createLogger('OrderMonitor');

const DEFAULT_POLL_INTERVAL = 60 * 1000;

class OrderMonitorService {
    private resolver: Resolver;
    private pollInterval: NodeJS.Timeout | null = null;
    private pollIntervalMs: number;

    constructor(resolverInstance: Resolver, pollIntervalMs: number = DEFAULT_POLL_INTERVAL) {
        this.resolver = resolverInstance;
        this.pollIntervalMs = pollIntervalMs
    }

    // Start monitor
    // This function run every minutes on main thread for now
    public start(): void {
        if (this.pollInterval) {
            logger.warn('Order monitor is already running.');
            return;
        }

        this.pollInterval = setInterval(async () => {
            // Look at the swap timelock.
            await this.resolver.checkAndHandleTimeout()

        }, this.pollIntervalMs);
    }

    public stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval); // Clear the timeout
            this.pollInterval = null; // Reset to null
            logger.info('Order monitor service stopped.');
        }
    }

}

export default OrderMonitorService