import { expect, test } from '@playwright/test';
import { utils, events } from '@jym272ticketing/common';
import { Order, Payment } from '@db/models';
import Stripe from 'stripe';
const { Streams, PaymentSubjects } = events;

const {
  httpStatusCodes,
  OrderStatus,
  createUniqueUser,
  generateA32BitUnsignedInteger,
  generateRandomString,
  getSequenceDataFromNats,
  logFinished,
  logRunning,
  parseMessage,
  truncateTables,
  createAValidPrice,
  createAValidPriceCents,
  insertIntoTableWithReturnJson
} = utils;
const { BAD_REQUEST, CREATED, UNAUTHORIZED } = httpStatusCodes;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));
// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

const user1 = createUniqueUser();
const user2 = createUniqueUser();

test.describe('routes: /api/payment POST requireAuth controller', () => {
  test("current user doesn't exists, not authorized by requireAuth common controller", async ({ request }) => {
    const response = await request.post('/api/payments', {
      data: {
        orderId: generateA32BitUnsignedInteger(),
        token: generateRandomString(32)
      }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});
test.describe('routes: /api/payment POST createPayment controller order not found', () => {
  test.beforeAll(async () => {
    await truncateTables('order');
  });
  test('order not found', async ({ request }) => {
    const response = await request.post('/api/payments', {
      data: {
        orderId: generateA32BitUnsignedInteger(),
        token: generateRandomString(32)
      },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Order not found.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
});

test.describe('routes: /api/payment POST createPayment controller not auth', () => {
  let order: Order, orderId: number;
  test.beforeAll(async () => {
    await truncateTables('order');
    orderId = generateA32BitUnsignedInteger();
    order = await insertIntoTableWithReturnJson<Order>('order', {
      id: orderId,
      status: OrderStatus.Created,
      userId: user1.userId,
      version: 0,
      ticket: {
        price: Number(createAValidPrice())
      }
    });
  });
  test('not authorized, current user: user2 is not the owner of the order: user1', async ({ request }) => {
    const response = await request.post('/api/payments', {
      data: {
        orderId: order.id,
        token: generateRandomString(32)
      },
      headers: { cookie: user2.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not Authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});

test.describe('routes: /api/payment POST createPayment controller order is cancelled', () => {
  let order: Order, orderId: number;
  test.beforeAll(async () => {
    await truncateTables('order');
    orderId = generateA32BitUnsignedInteger();
    order = await insertIntoTableWithReturnJson<Order>('order', {
      id: orderId,
      status: OrderStatus.Cancelled,
      userId: user1.userId,
      version: 0,
      ticket: {
        price: Number(createAValidPrice())
      }
    });
  });
  test('the order requested in db has been cancelled', async ({ request }) => {
    const response = await request.post('/api/payments', {
      data: {
        orderId: order.id,
        token: generateRandomString(32)
      },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Order is cancelled.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
});

test.describe('routes: /api/payment POST createPayment controller stripe token', () => {
  let order: Order, orderId: number;
  test.beforeAll(async () => {
    await truncateTables('order');
    orderId = generateA32BitUnsignedInteger();
    order = await insertIntoTableWithReturnJson<Order>('order', {
      id: orderId,
      status: OrderStatus.Created,
      userId: user1.userId,
      version: 0,
      ticket: {
        price: Number(createAValidPrice())
      }
    });
  });
  test('the charge is error because of token', async ({ request }) => {
    const invalidStripeToken = generateRandomString(32);
    const response = await request.post('/api/payments', {
      data: {
        orderId: order.id,
        token: invalidStripeToken
      },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Stripe charge failed.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
  test('the charge is successful', async ({ request }) => {
    const testStripeToken = 'tok_visa';
    const response = await request.post('/api/payments', {
      data: {
        orderId: order.id,
        token: testStripeToken
      },
      headers: { cookie: user1.cookie }
    });
    const { message, charge, payment, seq } = (await response.json()) as {
      message: string;
      charge: Stripe.Charge;
      payment: Payment;
      seq: number;
    };
    expect(response.ok()).toBe(true);
    expect(message).toBe('Payment created.');
    expect(response.status()).toBe(CREATED);
    // validate stripe charge
    expect(charge.amount).toBe(createAValidPriceCents(order.ticket.price));
    expect(payment.stripeCharge.id).toBe(charge.id);
    expect(payment.stripeCharge.amount).toBe(charge.amount);
    expect(payment.stripeCharge.currency).toBe(charge.currency);
    expect(payment.stripeCharge.status).toBe(charge.status);

    /*Testing the publish Event*/
    const seqData = await getSequenceDataFromNats<{ [PaymentSubjects.PaymentCreated]: Payment }>(Streams.PAYMENTS, seq);
    expect(seqData).toBeDefined();
    expect(seqData).toHaveProperty('subject', PaymentSubjects.PaymentCreated);
    expect(seqData).toHaveProperty('seq', seq);
    expect(seqData).toHaveProperty('data');
    expect(seqData).toHaveProperty('time'); //of the nats server arrival

    /*Comparing the payment with the one in the publish event*/
    expect(seqData.data[PaymentSubjects.PaymentCreated]).toBeDefined();
    const seqPaymentCreated = seqData.data[PaymentSubjects.PaymentCreated];
    expect(seqPaymentCreated).toHaveProperty('id', payment.id);
    expect(seqPaymentCreated).toHaveProperty('orderId', payment.orderId);
    expect(seqPaymentCreated).toHaveProperty('stripeCharge');
    expect(seqPaymentCreated).toHaveProperty('updatedAt', payment.updatedAt);
    expect(seqPaymentCreated).toHaveProperty('createdAt', payment.createdAt);
  });
});
