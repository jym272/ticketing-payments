import { expect, test } from '@playwright/test';
import { Order } from '@db/models';
import { events, utils } from '@jym272ticketing/common';
const {
  generateA32BitUnsignedInteger,
  logFinished,
  logRunning,
  publishToSubject,
  runPsqlCommandWithTimeout,
  truncateTables,
  createAValidPrice,
  log,
  insertIntoTableWithReturnJson,
  createUniqueUser,
  OrderStatus,
  runPsqlCommand,
  getRandomOrderStatus
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
const graceTime = 50; //ms
const nackTime = graceTime + Number(process.env.NACK_DELAY_MS);

// The only UPDATE that has order in orders-api is canceling an order,
// so the versioning has to be validated. OrderCancelled == OrderUpdate(this not exits)

const user1 = createUniqueUser();
const user2 = createUniqueUser();
const user3 = createUniqueUser();

test.describe('listener: orderUpdated success', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await truncateTables('order');
    await insertIntoTableWithReturnJson('order', {
      version: 0,
      id,
      userId: user1.userId,
      status: OrderStatus.Created,
      ticket: { price }
    });
  });

  test('subject orders.updated -> update Order in db', async () => {
    const newPrice = Number(createAValidPrice());
    const status = getRandomOrderStatus();
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 1, ticket: { price: newPrice }, status, userId: user2.userId }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id,  'ticket', ticket, 'version', version, 'status', status, 'userId', "userId") from "order" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    const order = JSON.parse(res) as Order;
    expect(order.id).toBe(id);
    expect(order.ticket.price).toBe(newPrice);
    expect(order.version).toBe(1);
    expect(order.status).toBe(status);
    expect(order.userId).toBe(user2.userId);
  });
});

test.describe('listener: orderUpdated Order version is not greater than the one in the DB', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await truncateTables('order');
    await insertIntoTableWithReturnJson('order', {
      version: 0,
      id,
      userId: user1.userId,
      status: OrderStatus.Created,
      ticket: { price }
    });
  });

  test('3 versions of order, 2 events with lower version than the last processed', async () => {
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 1 }
    });
    const newPrice = Number(createAValidPrice());
    const status = getRandomOrderStatus();
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 2, ticket: { price: newPrice }, status, userId: user2.userId }
    });
    // the messages are acknowledged by the listener, but the listener does not process them
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 0 }
    });
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 1 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id,  'ticket', ticket, 'version', version, 'status', status,  'userId', "userId") from "order" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    const order = JSON.parse(res) as Order;
    expect(order.id).toBe(id);
    expect(order.ticket.price).toBe(newPrice);
    expect(order.status).toBe(status);
    expect(order.userId).toBe(user2.userId);
    expect(order.version).toBe(2);
  });
});

test.describe('listener: orderUpdated Order version is not consecutive', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await truncateTables('order');
    await insertIntoTableWithReturnJson('order', {
      version: 0,
      id,
      userId: user1.userId,
      status: OrderStatus.Created,
      ticket: { price }
    });
  });

  test('waiting nack time until consecutive order version arrives', async () => {
    const orderUpdated1 = {
      id,
      version: 1,
      ticket: { price: Number(createAValidPrice()) },
      status: getRandomOrderStatus(),
      userId: user2.userId
    };
    const orderUpdated3 = {
      id,
      version: 3,
      ticket: { price: Number(createAValidPrice()) },
      status: getRandomOrderStatus(),
      userId: user3.userId
    };
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: orderUpdated1
    });

    // this message is nack by the listener, the last version processed is 1
    // this version is never going to be processed until the version 2 arrives
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: orderUpdated3
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));

    let res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id,  'ticket', ticket, 'version', version, 'status', status, 'userId', "userId") from "order" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    let order = JSON.parse(res) as Order;
    expect(order.id).toBe(id);
    expect(order.version).toBe(1);
    expect(order.ticket.price).toBe(orderUpdated1.ticket.price);
    expect(order.status).toBe(orderUpdated1.status);
    expect(order.userId).toBe(orderUpdated1.userId);

    // publishing the missing version 2, the missing version 2 is processed and also 3
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: { id, version: 2 }
    });
    // giving some grace time to the listener to process the event
    log(`waiting ${nackTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, nackTime));

    res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id,  'ticket', ticket, 'version', version, 'status', status, 'userId', "userId") from "order" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    order = JSON.parse(res) as Order;
    // version3 is the last version processed
    expect(order.version).toBe(3);
    expect(order.id).toBe(id);
    expect(order.ticket.price).toBe(orderUpdated3.ticket.price);
    expect(order.status).toBe(orderUpdated3.status);
    expect(order.userId).toBe(orderUpdated3.userId);
  });
});

test.describe('listener: orderUpdated Order does not exist, maybe is not created yet', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await truncateTables('order');
  });

  test('race conditions, first arrives OrderUpdated, is nack until event OrderCreated arrives', async () => {
    const orderUpdated1 = {
      id,
      version: 1,
      ticket: { price: Number(createAValidPrice()) },
      status: getRandomOrderStatus(),
      userId: user2.userId
    };

    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: orderUpdated1
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    let res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status,  'ticket', ticket, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    expect(res.trim()).toBe('');

    await publishToSubject(subjects.OrderCreated, {
      [subjects.OrderCreated]: { id, ticket: { price }, userId: user1.userId, status: OrderStatus.Created, version: 0 }
    });

    // the order is created, also the previous event is processed
    log(`waiting ${nackTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, nackTime));
    res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status,  'ticket', ticket, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    const order = JSON.parse(res) as Order;
    expect(order.id).toBe(id);
    expect(order.version).toBe(1);
    expect(order.status).toBe(orderUpdated1.status);
    expect(order.ticket.price).toBe(orderUpdated1.ticket.price);
    expect(order.userId).toBe(orderUpdated1.userId);
  });
});

test.describe('listener: orderUpdated nack max retries is reached', () => {
  let id: number, price: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    price = Number(createAValidPrice());
    await truncateTables('order');
  });

  test('race conditions, first arrives OrderUpdated, is nacking until max retries, order is not updated', async () => {
    const orderUpdated1 = {
      id,
      version: 1,
      ticket: { price: Number(createAValidPrice()) },
      status: getRandomOrderStatus(),
      userId: user2.userId
    };
    await publishToSubject(subjects.OrderUpdated, {
      [subjects.OrderUpdated]: orderUpdated1
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    let res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status,  'ticket', ticket, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    expect(res.trim()).toBe('');

    const nackTime = Number(process.env.NACK_DELAY_MS) * Number(process.env.NACK_MAX_RETRIES) + graceTime;
    log(`waiting ${nackTime} ms for the naking to be terminated`);
    await new Promise(resolve => setTimeout(resolve, nackTime));

    // the order is created, but is not updated by previous events, those events were terminated by max retries
    await publishToSubject(subjects.OrderCreated, {
      [subjects.OrderCreated]: { id, ticket: { price }, userId: user1.userId, status: OrderStatus.Created, version: 0 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));

    res = await runPsqlCommand(
      `select jsonb_build_object('id', id, 'status', status,  'ticket', ticket, 'version', version, 'userId', "userId") from "order" where id=${id}`
    );
    const order = JSON.parse(res) as Order;
    expect(order.status).toBe(OrderStatus.Cancelled);
    expect(order.id).toBe(id);
    expect(order.ticket.price).toBe(price);
    expect(order.version).toBe(0);
    expect(order.userId).toBe(user1.userId);
  });
});
