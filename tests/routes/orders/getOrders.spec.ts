import { expect, test } from '@playwright/test';
import { utils } from '@jym272ticketing/common';
import { Order, Ticket } from '@db/models';

const {
  httpStatusCodes,
  createUniqueUser,
  generateTicketAttributes,
  insertIntoTableWithReturnJson,
  logFinished,
  logRunning,
  parseMessage,
  truncateTables
} = utils;
const { UNAUTHORIZED } = httpStatusCodes;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));
// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

const user1 = createUniqueUser();
const user2 = createUniqueUser();

test.describe('routes: /api/orders GET requireAuth controller', () => {
  test("current user doesn't exists, not authorized by requireAuth common controller", async ({ request }) => {
    const response = await request.get('/api/orders');
    const message = await parseMessage(response);
    expect(response.ok()).toBe(false);
    expect(message).toBe('Not authorized.');
    expect(response.status()).toBe(UNAUTHORIZED);
  });
});

test.describe('routes: /api/orders GET getOrdersController 3 tickets 2 owners', () => {
  let ticketA: Ticket, ticketB: Ticket, ticketC: Ticket;
  let orderA: Order, orderB: Order, orderC: Order;
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
    /*Tickets*/
    ticketA = await insertIntoTableWithReturnJson('ticket', { version: 0, ...generateTicketAttributes() });
    ticketB = await insertIntoTableWithReturnJson('ticket', { version: 0, ...generateTicketAttributes() });
    ticketC = await insertIntoTableWithReturnJson('ticket', { version: 0, ...generateTicketAttributes() });

    /*Orders*/
    orderA = await insertIntoTableWithReturnJson('order', {
      userId: user1.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ticketId: ticketA.id
    });
    orderB = await insertIntoTableWithReturnJson('order', {
      userId: user2.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ticketId: ticketB.id
    });
    orderC = await insertIntoTableWithReturnJson('order', {
      userId: user2.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ticketId: ticketC.id
    });
  });

  test('user1 owns 1 order, 1 ticket', async ({ request }) => {
    const response = await request.get('/api/orders', {
      headers: { cookie: user1.cookie }
    });
    expect(response.ok()).toBe(true);
    const orders = (await response.json()) as Order[];
    expect(orders).toBeDefined();
    expect(orders.length).toBe(1);
    const { id, userId, status, expiresAt, ticketId, ticket } = orders[0];
    expect(id).toBe(orderA.id);
    expect(userId).toBe(orderA.userId);
    expect(status).toBe(orderA.status);
    expect(new Date(expiresAt)).toStrictEqual(new Date(orderA.expiresAt));
    expect(ticketId).toBe(orderA.ticketId);
    expect(ticketId).toBe(ticketA.id);

    expect(ticket).toBeDefined();
    expect(ticket?.id).toBe(ticketA.id);
    expect(ticket?.price).toBe(ticketA.price);
    expect(ticket?.title).toBe(ticketA.title);
  });
  test('user2 owns 2 orders, 2 tickets', async ({ request }) => {
    const response = await request.get('/api/orders', {
      headers: { cookie: user2.cookie }
    });
    expect(response.ok()).toBe(true);
    const orders = (await response.json()) as Order[];
    expect(orders).toBeDefined();
    expect(orders.length).toBe(2);
    const compareOrderB = (index: 0 | 1) => {
      const { id, userId, status, expiresAt, ticketId, ticket } = orders[index];
      expect(id).toBe(orderB.id);
      expect(userId).toBe(orderB.userId);
      expect(status).toBe(orderB.status);
      expect(new Date(expiresAt)).toStrictEqual(new Date(orderB.expiresAt));
      expect(ticketId).toBe(orderB.ticketId);
      expect(ticketId).toBe(ticketB.id);

      expect(ticket).toBeDefined();
      expect(ticket?.id).toBe(ticketB.id);
      expect(ticket?.price).toBe(ticketB.price);
      expect(ticket?.title).toBe(ticketB.title);
    };
    const compareOrderC = (index: 0 | 1) => {
      const { id, userId, status, expiresAt, ticketId, ticket } = orders[index];
      expect(id).toBe(orderC.id);
      expect(userId).toBe(orderC.userId);
      expect(status).toBe(orderC.status);
      expect(new Date(expiresAt)).toStrictEqual(new Date(orderC.expiresAt));
      expect(ticketId).toBe(orderC.ticketId);
      expect(ticketId).toBe(ticketC.id);

      expect(ticket).toBeDefined();
      expect(ticket?.id).toBe(ticketC.id);
      expect(ticket?.price).toBe(ticketC.price);
      expect(ticket?.title).toBe(ticketC.title);
    };
    compareOrderB(orders[0].id === orderB.id ? 0 : 1);
    compareOrderC(orders[0].id === orderC.id ? 0 : 1);
  });
});
