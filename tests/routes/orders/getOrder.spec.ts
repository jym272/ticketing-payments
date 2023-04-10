import { expect, test } from '@playwright/test';
import { utils } from '@jym272ticketing/common';
import { Order, Ticket } from '@db/models';

const {
  httpStatusCodes,
  createUniqueUser,
  generateA32BitUnsignedInteger,
  generateRandomString,
  generateTicketAttributes,
  insertIntoTableWithReturnJson,
  logFinished,
  logRunning,
  parseMessage,
  truncateTables
} = utils;
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

test.describe('routes: /api/orders/:id GET requireAuth controller', () => {
  test("current user doesn't exists, not authorized by requireAuth common controller", async ({ request }) => {
    const response = await request.get(`/api/orders/${validTicketId}`);
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});

test.describe('routes: /api/orders/:id GET getOrderController valid/invalid order tk', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
  });
  test('invalid order id', async ({ request }) => {
    const response = await request.get(`/api/orders/${invalidId}`, {
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Getting Order failed.');
    expect(response.status()).toBe(INTERNAL_SERVER_ERROR);
  });
  test('valid order id, but no orders in database', async ({ request }) => {
    const response = await request.get(`/api/orders/${validTicketId}`, {
      headers: { cookie: user1.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Order not found.');
    expect(response.status()).toBe(NOT_FOUND);
  });
});

test.describe('routes: /api/orders/:id GET getOrderController user ownership of order', () => {
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
    const response = await request.get(`/api/orders/${orderFromUser1.id}`, {
      headers: { cookie: user2.cookie }
    });
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('You are not authorized to view this order.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
  test('user1 make the request, order found and belongs to user1', async ({ request }) => {
    const response = await request.get(`/api/orders/${orderFromUser1.id}`, {
      headers: { cookie: user1.cookie }
    });
    expect(response.ok()).toBe(true);
    const order = (await response.json()) as Order;
    expect(order).toBeDefined();
    const { id, userId, status, expiresAt, ticketId, ticket } = order;
    expect(id).toBe(orderFromUser1.id);
    expect(userId).toBe(orderFromUser1.userId);
    expect(status).toBe(orderFromUser1.status);
    expect(new Date(expiresAt)).toStrictEqual(new Date(orderFromUser1.expiresAt));
    expect(ticketId).toBe(orderFromUser1.ticketId);
    expect(ticketId).toBe(ticketA.id);

    expect(ticket).toBeDefined();
    expect(ticket?.id).toBe(ticketA.id);
    expect(ticket?.price).toBe(ticketA.price);
    expect(ticket?.title).toBe(ticketA.title);
  });
});
