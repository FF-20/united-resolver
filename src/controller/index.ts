import { Request, Response, NextFunction } from 'express';
import Service from '../service/service';

class ResolverController {
    private service: Service
    constructor() {
        this.service = new Service
    }

    async ReceiveOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const fillOrderArgs = req.body;
            this.service.handleOrder(fillOrderArgs)
        }
    }

    async ReceiveSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const {secret, srcEscrow, dstEscrow} = req.body;
            this.service.handleSecret()
        }
    }
}

export default new ResolverController();