import { Request, Response } from 'express';
import { getSequelizeClient, Order, Payment } from '@db/index';
import { utils, events } from '@jym272ticketing/common';

import { getStripeClient } from '@stripe/stripe';
import Stripe from 'stripe';
const { publish, subjects } = events;
const { createAValidPriceCents, OrderStatus, httpStatusCodes, throwError, parseSequelizeError } = utils;
const { CREATED, BAD_REQUEST, INTERNAL_SERVER_ERROR, UNAUTHORIZED } = httpStatusCodes;
const sequelize = getSequelizeClient();

// SOME COMMENT
export const createAPaymentController = () => {
  return async (req: Request, res: Response) => {
    const { token, orderId } = req.body as { token: string; orderId: string };

    // TODO: validate orderId and token
    // if (Number.isNaN(Number(ticketId)) || Number(ticketId) <= 0) {
    //   throwError('Invalid ticketId.', BAD_REQUEST, new Error(`TicketId is required: ${ticketId}`));
    // }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- because of requireAuth middleware
    const currentUser = req.currentUser!;
    const userId = currentUser.jti;

    let orderFound: Order | null;
    try {
      orderFound = await Order.findByPk(orderId);
    } catch (err) {
      const error = parseSequelizeError(
        err,
        `Finding an Order failed. orderId ${orderId}. currentUser ${JSON.stringify(currentUser)}`
      );
      return throwError('Finding Order failed.', INTERNAL_SERVER_ERROR, error);
    }
    if (!orderFound) {
      return throwError('Order not found.', BAD_REQUEST, new Error(`Order not found: ${orderId}`));
    }

    if (orderFound.userId !== Number(userId)) {
      throwError(
        'Not Authorized.',
        UNAUTHORIZED,
        new Error(
          `Not Authorized: ${orderId} order owner: ${orderFound.userId} currentUser ${JSON.stringify(currentUser)}`
        )
      );
    }
    if (orderFound.status === OrderStatus.Cancelled) {
      throwError(
        'Order is cancelled.',
        BAD_REQUEST,
        new Error(`Order is cancelled: ${orderId} currentUser ${JSON.stringify(currentUser)}`)
      );
    }
    const stripe = getStripeClient();

    const descriptionObject = JSON.parse(JSON.stringify(currentUser)) as Record<string, unknown>;
    descriptionObject.order = orderFound;

    let charge: Stripe.Charge;

    try {
      charge = await stripe.charges.create({
        amount: createAValidPriceCents(orderFound.ticket.price),
        currency: 'usd',
        source: token,
        description: JSON.stringify(descriptionObject)
      });
    } catch (err) {
      return throwError('Stripe charge failed.', BAD_REQUEST, err as Error);
    }

    let payment;
    let seq;

    try {
      payment = await sequelize.transaction(async () => {
        const newPayment = await Payment.create({
          orderId: Number(orderId),
          stripeCharge: charge
        });
        const pa = await publish(newPayment, subjects.PaymentCreated);
        seq = pa.seq; // The sequence number of the message as stored in JetStream
        return newPayment;
      });
      return res.status(CREATED).send({ message: 'Payment created.', charge, payment, seq });
    } catch (err) {
      const error = parseSequelizeError(
        err,
        `Creating a Payment failed. orderId ${orderId}. currentUser ${JSON.stringify(currentUser)}`
      );
      throwError('Creating a Payment failed.', INTERNAL_SERVER_ERROR, error);
    }
  };
};
