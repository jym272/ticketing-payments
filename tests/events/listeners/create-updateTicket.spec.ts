import { expect, test } from '@playwright/test';
import { Ticket } from '@db/models';
import { events, utils } from '@jym272ticketing/common';
const {
  generateA32BitUnsignedInteger,
  generateTicketAttributes,
  logFinished,
  logRunning,
  publishToSubject,
  runPsqlCommandWithTimeout,
  truncateTables,
  createAValidPrice,
  log
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

test.describe('listener: ticketListener ticket created and updated events ', () => {
  let id: number;
  test.beforeAll(async () => {
    id = generateA32BitUnsignedInteger();
    await truncateTables('ticket', 'order');
  });

  test('subject tickets.created new Ticket in db', async () => {
    const { title, price } = generateTicketAttributes();

    await publishToSubject(subjects.TicketCreated, {
      [subjects.TicketCreated]: { id, title, price, version: 0 }
    });

    //retrieve the ticket directly from the db, the subscriber can be taking some time to process the event
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'title', title, 'price', price, 'version', version) from "ticket" where id=${id}`
    );
    if (!res) {
      // actually if res is empty and the timeout is complete it throws an error
      // but ts thinks is resolved undefined because of the waiting
      throw new Error('No result');
    }
    const ticket = JSON.parse(res) as Ticket;
    expect(ticket.id).toBe(id);
    expect(ticket.title).toBe(title);
    expect(ticket.price).toBe(price);
    expect(ticket.version).toBe(0);
  });

  test('subject tickets.updated update Ticket already in db', async () => {
    const { title: newTitle, price: newPrice } = generateTicketAttributes();
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title: newTitle, price: newPrice, version: 1 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'title', title, 'price', price, 'version', version) from "ticket" where price=${newPrice} and title='${newTitle}'`
    );
    if (!res) {
      throw new Error('No result');
    }
    const ticket = JSON.parse(res) as Ticket;
    expect(ticket.id).toBe(id);
    expect(ticket.title).toBe(newTitle);
    expect(ticket.price).toBe(newPrice);
    expect(ticket.version).toBe(1);
  });
});

test.describe('listener: Ticket version is not greater than the one in the DB', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
  });

  test('3 version of ticket, 2 events with lower version than the last processed', async () => {
    const arrayLength = 3;
    const { title } = generateTicketAttributes();
    const id = generateA32BitUnsignedInteger();

    const prices = Array(arrayLength)
      .fill(0)
      .map(() => Number(createAValidPrice()));

    await publishToSubject(subjects.TicketCreated, {
      [subjects.TicketCreated]: { id, title, price: prices[0], version: 0 }
    });
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[1], version: 1 }
    });
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[2], version: 2 }
    });
    // the messages are acknowledged by the listener, but the listener does not process them
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[0], version: 0 }
    });
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[1], version: 1 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));
    const res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'title', title, 'price', price, 'version', version) from "ticket" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    const ticket = JSON.parse(res) as Ticket;
    expect(ticket.id).toBe(id);
    expect(ticket.title).toBe(title);
    expect(ticket.price).toBe(prices[2]);
    expect(ticket.version).toBe(2);
  });
});

test.describe('listener: Ticket version is not consecutive', () => {
  test.beforeAll(async () => {
    await truncateTables('ticket', 'order');
  });

  test('waiting nack time until consecutive ticket version arrives', async () => {
    const arrayLength = 4;
    const { title } = generateTicketAttributes();
    const id = generateA32BitUnsignedInteger();
    const nackTime = graceTime + Number(process.env.NACK_DELAY_MS);

    const prices = Array(arrayLength)
      .fill(0)
      .map(() => Number(createAValidPrice()));

    await publishToSubject(subjects.TicketCreated, {
      [subjects.TicketCreated]: { id, title, price: prices[0], version: 0 }
    });
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[1], version: 1 }
    });
    // this message is nack by the listener, the last version processed is 1
    // this version is never going to be processed until the version 2 arrives
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[3], version: 3 }
    });

    log(`waiting ${graceTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, graceTime));

    let res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'title', title, 'price', price, 'version', version) from "ticket" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    let ticket = JSON.parse(res) as Ticket;
    expect(ticket.id).toBe(id);
    expect(ticket.title).toBe(title);
    expect(ticket.price).toBe(prices[1]); // is the last version processed
    expect(ticket.version).toBe(1);

    // publishing the missing version 2, the missing version 2 is processed and also 3
    await publishToSubject(subjects.TicketUpdated, {
      [subjects.TicketUpdated]: { id, title, price: prices[2], version: 2 }
    });
    // giving some grace time to the listener to process the event
    log(`waiting ${nackTime} ms for the listener to process the events`);
    await new Promise(resolve => setTimeout(resolve, nackTime));

    res = await runPsqlCommandWithTimeout(
      `select jsonb_build_object('id', id, 'title', title, 'price', price, 'version', version) from "ticket" where id=${id}`
    );
    if (!res) {
      throw new Error('No result');
    }
    ticket = JSON.parse(res) as Ticket;
    expect(ticket.id).toBe(id);
    expect(ticket.title).toBe(title);
    expect(ticket.price).toBe(prices[3]); // is the last version processed
    expect(ticket.version).toBe(3);
  });
});
