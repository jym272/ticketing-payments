import { expect, test } from '@playwright/test';
import { Order } from '@db/models';
import { events, utils } from '@jym272ticketing/common';
const {
  logFinished,
  logRunning,
  publishToSubject,
  runPsqlCommandWithTimeout,
  truncateTables,
  log,
  OrderStatus,
  createUniqueUser,
  generateA32BitUnsignedInteger,
  createAValidPrice,
  insertIntoTableWithReturnJson,
  runPsqlCommand
} = utils;
const { subjects } = events;

// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.beforeEach(({}, testInfo) => logRunning(testInfo));
// eslint-disable-next-line no-empty-pattern -- because we need to pass only the testInfo
test.afterEach(({}, testInfo) => logFinished(testInfo));

/*
  Only can prove happy paths, these test are async, but it is difficult to know when the listener
  has finished to process the events. If the test fails increase the graceTime
 */
const graceTime = 100;

const user1 = createUniqueUser();

test.describe('listener: orderCreated', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    await truncateTables('order');
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
  });
  test('it fails because is not version 0', async () => {
    const version = generateA32BitUnsignedInteger();
    await publishToSubject(subjects.OrderCreated, {
      [subjects.OrderCreated]: { id, price, userId: user1.userId, status: OrderStatus.Created, version }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status, 'price', price, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    expect(res.trim()).toBe('');
  });

  test('success listening and creating the order', async () => {
    await publishToSubject(subjects.OrderCreated, {
      [subjects.OrderCreated]: { id, price, userId: user1.userId, status: OrderStatus.Created, version: 0 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'status', status, 'price', price, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    const order = JSON.parse(res) as Order;
    expect(order.status).toBe(OrderStatus.Created);
    expect(order.id).toBe(id);
    expect(order.price).toBe(price);
    expect(order.version).toBe(0);
    expect(order.userId).toBe(user1.userId);
  });
});

test.describe('listener: orderCreated already an order in db', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    await truncateTables('order');
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await insertIntoTableWithReturnJson('order', {
      version: 0,
      id,
      userId: user1.userId,
      status: OrderStatus.Created,
      price
    });
  });
  test('fails because is already an order with the same id in db', async () => {
    const newPrice = Number(createAValidPrice());
    await publishToSubject(subjects.OrderCreated, {
      [subjects.OrderCreated]: { id, price: newPrice, userId: user1.userId, status: OrderStatus.Created, version: 0 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status, 'price', price, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    const order = JSON.parse(res) as Order;
    expect(order.price).not.toBe(newPrice);
    expect(order.price).toBe(price);
    expect(order.id).toBe(id);
  });
});
