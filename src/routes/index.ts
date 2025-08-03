import express from 'express';
import ResolverController from '../controller';

const router = express.Router();

const version = 'v1'

router.post(`/${version}/relay/order`, ResolverController.ReceiveOrder)

router.post(`/${version}/relay/secret`, ResolverController.ReceiveSecret)