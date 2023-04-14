import { JsMsg } from 'nats';
import { Order } from '@db/models';
import { log } from '@jym272ticketing/common/dist/utils';
import { getSequelizeClient } from '@db/sequelize';
import { nakTheMsg, OrderSubjects, sc, subjects } from '@jym272ticketing/common/dist/events';

const sequelize = getSequelizeClient();

const orderCreated = async (m: JsMsg, order: Order) => {
  m.working();
  if (order.version !== 0) {
    log('Order version is not 0');
    m.term();
    return;
  }
  try {
    const orderFound = await Order.findByPk(order.id, { attributes: ['id'] });
    if (orderFound) {
      log('Order already exists, did you mean to update it?');
      m.term();
      return;
    }
  } catch (err) {
    log('Error processing order', err);
    nakTheMsg(m);
    return;
  }
  try {
    await sequelize.transaction(async () => {
      /*const newTicket =*/ await Order.create({
        id: order.id,
        userId: order.userId,
        status: order.status,
        ticket: order.ticket,
        version: order.version
      });
      // const pa = await publish(order, subjects.OrderCreated); TODO: publish to the interested, it must be in the transaction
      // seq = pa.seq; // The sequence number of the message as stored in JetStream
      m.ack();
    });
  } catch (e) {
    log('Error creating order', e);
    nakTheMsg(m);
    return;
  }
};

export const orderCreatedListener = async (m: JsMsg) => {
  if (m.subject !== subjects.OrderCreated) {
    log('Wrong subject', m.subject);
    m.term();
    return;
  }
  let order: Order | undefined;
  try {
    const data = JSON.parse(sc.decode(m.data)) as Record<OrderSubjects, Order | undefined>;
    order = data[subjects.OrderCreated];
    if (!order) throw new Error(`order not found in message data with subject ${m.subject}`);
  } catch (e) {
    log('Error parsing message data', e);
    m.term();
    return;
  }
  await orderCreated(m, order);
};
