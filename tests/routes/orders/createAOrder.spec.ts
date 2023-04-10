import { expect, test } from '@playwright/test';
import { utils, events } from '@jym272ticketing/common';
import { TICKET_ATTRIBUTES } from '@utils/index';
import { Order, Ticket } from '@db/models';
const { OrderSubjects, Streams } = events;

const {
  httpStatusCodes,
  OrderStatus,
  createACookieSession,
  createUniqueUser,
  generateA32BitUnsignedInteger,
  generateRandomString,
  generateTicketAttributes,
  getSequenceDataFromNats,
  insertIntoTableWithReturnJson,
  logFinished,
  logRunning,
  parseMessage,
  truncateTables
} = utils;
const { BAD_REQUEST, CREATED, INTERNAL_SERVER_ERROR, UNAUTHORIZED } = httpStatusCodes;
const { MAX_VALID_TITLE_LENGTH } = TICKET_ATTRIBUTES;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));
// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

const user1 = createUniqueUser();

test.describe('routes: /api/orders POST requireAuth controller', () => {
  test("current user doesn't exists, not authorized by requireAuth common controller", async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: {
        ticketId: generateA32BitUnsignedInteger()
      }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});

test.describe('routes: /api/orders POST checking body { ticketId: string|number }', () => {
  test('invalid ticketId because is not a number', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: {
        ticketId: generateRandomString(MAX_VALID_TITLE_LENGTH)
      },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Invalid ticketId.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
  test('invalid ticketId because is a negative number', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: {
        ticketId: generateA32BitUnsignedInteger() * -1
      },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Invalid ticketId.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
});

test.describe('routes: /api/orders POST createAOrderController failed, there is no ticketId', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
  });
  test('there is no values in "ticket" table', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: { ticketId: generateA32BitUnsignedInteger() },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Ticket not found.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
});

test.describe('routes: /api/orders POST createAOrderController ticket exists, an order exists for that ticket', () => {
  let ticket: Ticket;
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
    ticket = await insertIntoTableWithReturnJson('ticket', { version: 0, ...generateTicketAttributes() });
    await insertIntoTableWithReturnJson('order', {
      userId: user1.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ticketId: ticket.id
    });
  });
  test('fail because there is already an order with status "created" for that ticketId', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: { ticketId: ticket.id },
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Ticket is already reserved.');
    expect(response.status()).toBe(BAD_REQUEST);
  });
});

test.describe('routes: /api/orders POST createAOrderController', () => {
  let ticket: Ticket;
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
    ticket = await insertIntoTableWithReturnJson('ticket', { version: 0, ...generateTicketAttributes() });
  });

  test('failed because of userId invalid in cookie', async ({ request }) => {
    const cookieWithInvalidUserId = createACookieSession({
      userEmail: 'a@a.com',
      userId: Math.pow(2, 31) //out of range for type integer
    });
    const response = await request.post('/api/orders', {
      data: { ticketId: ticket.id },
      headers: { cookie: cookieWithInvalidUserId }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Creating Order failed.');
    expect(response.status()).toBe(INTERNAL_SERVER_ERROR);
  });
  test('success creating the order, a publish event is made', async ({ request }) => {
    const response = await request.post('/api/orders', {
      data: { ticketId: ticket.id },
      headers: { cookie: user1.cookie }
    });
    const { seq, message, order } = (await response.json()) as { seq: number; message: string; order: Order };
    expect(response.ok()).toBe(true);
    expect(message).toBe('Order created.');
    expect(response.status()).toBe(CREATED);
    expect(seq).toBeGreaterThan(0);
    // Order
    expect(order).toBeDefined();
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('userId', user1.userId);
    expect(order).toHaveProperty('ticketId', ticket.id);
    expect(order).toHaveProperty('status', OrderStatus.Created);
    expect(order).toHaveProperty('expiresAt');
    expect(order).toHaveProperty('updatedAt');
    expect(order).toHaveProperty('createdAt');

    /*Testing the publish Event*/
    const seqData = await getSequenceDataFromNats<{ [OrderSubjects.OrderCreated]: Order }>(Streams.ORDERS, seq);
    expect(seqData).toBeDefined();
    expect(seqData).toHaveProperty('subject', OrderSubjects.OrderCreated);
    expect(seqData).toHaveProperty('seq', seq);
    expect(seqData).toHaveProperty('data');
    expect(seqData).toHaveProperty('time'); //of the nats server arrival

    /*Comparing the order with the one in the publish event*/
    expect(seqData.data[OrderSubjects.OrderCreated]).toBeDefined();
    const seqDataOrder = seqData.data[OrderSubjects.OrderCreated];

    expect(seqDataOrder).toHaveProperty('id', order.id);
    expect(seqDataOrder).toHaveProperty('userId', order.userId);
    expect(seqDataOrder).toHaveProperty('ticketId', order.ticketId);
    expect(seqDataOrder).toHaveProperty('status', order.status);
    expect(seqDataOrder).toHaveProperty('expiresAt', order.expiresAt);
    expect(seqDataOrder).toHaveProperty('updatedAt', order.updatedAt);
    expect(seqDataOrder).toHaveProperty('createdAt', order.createdAt);
  });
});
