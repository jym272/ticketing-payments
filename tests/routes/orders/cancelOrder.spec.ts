import { expect, test } from '@playwright/test';
import { utils, events } from '@jym272ticketing/common';
import { Order, Ticket } from '@db/models';

const {
  httpStatusCodes,
  OrderStatus,
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
const { OrderSubjects, Streams } = events;
const { UNAUTHORIZED, INTERNAL_SERVER_ERROR, NOT_FOUND } = httpStatusCodes;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));
// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

const user1 = createUniqueUser();
const user2 = createUniqueUser();

let ticketA: Ticket;
let orderFromUser1: Order;
const validTicketId = generateA32BitUnsignedInteger();
const invalidId = generateRandomString(5);

test.describe('routes: /api/orders/:id PATCH requireAuth controller', () => {
  test("current user doesn't exists, not authorized by requireAuth common controller", async ({ request }) => {
    const response = await request.patch(`/api/orders/${validTicketId}`);
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});

test.describe('routes: /api/orders/:id PATCH cancelOrderController valid/invalid order tk', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
  });
  test('invalid order id', async ({ request }) => {
    const response = await request.patch(`/api/orders/${invalidId}`, {
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Cancel Order failed.');
    expect(response.status()).toBe(INTERNAL_SERVER_ERROR);
  });
  test('valid order id, but no orders in database', async ({ request }) => {
    const response = await request.patch(`/api/orders/${validTicketId}`, {
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Order not found.');
    expect(response.status()).toBe(NOT_FOUND);
  });
});

test.describe('routes: /api/orders/:id PATCH cancelOrderController user ownership of order', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
    ticketA = await insertIntoTableWithReturnJson('ticket', { ...generateTicketAttributes(), version: 0 });
    orderFromUser1 = await insertIntoTableWithReturnJson('order', {
      userId: user1.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ticketId: ticketA.id
    });
  });
  test('user2 make the request, order found but no belongs to user2, it belongs to user1', async ({ request }) => {
    const response = await request.patch(`/api/orders/${orderFromUser1.id}`, {
      headers: { cookie: user2.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('You are not authorized to cancel this order.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
  test('user1 make the request, order found and belongs to user1', async ({ request }) => {
    const response = await request.patch(`/api/orders/${orderFromUser1.id}`, {
      headers: { cookie: user1.cookie }
    });
    expect(response.ok()).toBe(true);
    const { seq, message, order } = (await response.json()) as { seq: number; message: string; order: Order };
    expect(message).toBe('Order cancelled.');
    expect(order).toBeDefined();
    const { id, userId, status, expiresAt, ticketId, ticket, version } = order;
    expect(id).toBe(orderFromUser1.id);
    expect(userId).toBe(orderFromUser1.userId);
    expect(status).not.toBe(orderFromUser1.status);
    expect(status).toBe(OrderStatus.Cancelled);
    expect(version).not.toBe(orderFromUser1.version);
    expect(version).toBe(1);
    expect(version).toBe(orderFromUser1.version + 1);
    expect(new Date(expiresAt)).toStrictEqual(new Date(orderFromUser1.expiresAt));
    expect(ticketId).toBe(orderFromUser1.ticketId);
    expect(ticketId).toBe(ticketA.id);

    expect(ticket).toBeDefined();
    expect(ticket?.id).toBe(ticketA.id);
    expect(ticket?.price).toBe(ticketA.price);
    expect(ticket?.title).toBe(ticketA.title);

    /*Testing the publish Event*/
    const seqData = await getSequenceDataFromNats<{ [OrderSubjects.OrderCancelled]: Order }>(Streams.ORDERS, seq);
    expect(seqData).toBeDefined();
    expect(seqData).toHaveProperty('subject', OrderSubjects.OrderCancelled);
    expect(seqData).toHaveProperty('seq', seq);
    expect(seqData).toHaveProperty('data');
    expect(seqData).toHaveProperty('time'); //of the nats server arrival

    /*Comparing the order with the one in the publish event, this order is populated with the ticket*/
    expect(seqData.data[OrderSubjects.OrderCancelled]).toBeDefined();
    const seqDataOrder = seqData.data[OrderSubjects.OrderCancelled];

    expect(seqDataOrder).toHaveProperty('id', order.id);
    expect(seqDataOrder).toHaveProperty('userId', order.userId);
    expect(seqDataOrder).toHaveProperty('ticketId', order.ticketId);
    expect(seqDataOrder).toHaveProperty('status', order.status);
    expect(seqDataOrder).toHaveProperty('expiresAt', order.expiresAt);
    expect(seqDataOrder).toHaveProperty('updatedAt', order.updatedAt);
    expect(seqDataOrder).toHaveProperty('createdAt', order.createdAt);

    expect(seqDataOrder).toHaveProperty('ticket');
    expect(seqDataOrder.ticket).toHaveProperty('id', ticket?.id);
    expect(seqDataOrder.ticket).toHaveProperty('price', ticket?.price);
    expect(seqDataOrder.ticket).toHaveProperty('title', ticket?.title);
    expect(seqDataOrder.ticket).toHaveProperty('updatedAt', ticket?.updatedAt);
    expect(seqDataOrder.ticket).toHaveProperty('createdAt', ticket?.createdAt);
  });
});
