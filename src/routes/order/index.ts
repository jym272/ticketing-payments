import { Router } from 'express';
import { orderController } from '@controllers/order';
import { commonController } from '@jym272ticketing/common';
import { getEnvOrFail } from '@utils/env';
import { httpStatusCodes } from '@jym272ticketing/common/dist/utils';
import { nc } from '@jym272ticketing/common/dist/events';
const { verifyCurrentUser, requireAuth } = commonController;
const { createAOrder, getOrders, getOrder, cancelOrder } = orderController;
const { BAD_REQUEST, OK } = httpStatusCodes;

const secret = getEnvOrFail('JWT_SECRET');
const authMiddleware = Router();
authMiddleware.use(verifyCurrentUser(secret), requireAuth);

export const order = Router();

order.post('/api/orders', authMiddleware, createAOrder);
order.get('/api/orders', authMiddleware, getOrders);
order.get('/api/orders/:id', authMiddleware, getOrder);
order.patch('/api/orders/:id', authMiddleware, cancelOrder);

//TODO: refactor, maybe common api later
order.get('/api/healthz', (req, res) => {
  const ncIsClosed = nc ? nc.isClosed() : true;
  if (ncIsClosed) {
    return res.status(BAD_REQUEST).send({ status: 'error' });
  }
  return res.status(OK).send({ status: 'ok' });
});
