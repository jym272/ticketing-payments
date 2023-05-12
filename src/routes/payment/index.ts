import { Router } from 'express';
import { paymentController } from '@controllers/payment';
import { commonController } from '@jym272ticketing/common';
import { getEnvOrFail } from '@jym272ticketing/common/dist/utils';
const { verifyCurrentUser, requireAuth } = commonController;
const { createAPayment } = paymentController;

const secret = getEnvOrFail('JWT_SECRET');
const authMiddleware = Router();
authMiddleware.use(verifyCurrentUser(secret), requireAuth);

export const payment = Router();
payment.post('/api/payments', authMiddleware, createAPayment);
