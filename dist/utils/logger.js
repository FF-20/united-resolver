"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return `${timestamp} [${service || 'Resolver'}] ${level.toUpperCase()}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
}));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'CrossChainResolver' },
    transports: [
        // Write all logs to console
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        // Write all logs to combined.log
        new winston_1.default.transports.File({
            filename: 'logs/resolver.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Write error logs to error.log
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});
// Create logs directory if it doesn't exist
const fs_1 = __importDefault(require("fs"));
if (!fs_1.default.existsSync('logs')) {
    fs_1.default.mkdirSync('logs');
}
function createLogger(service) {
    return logger.child({ service });
}
exports.default = logger;
//# sourceMappingURL=logger.js.map