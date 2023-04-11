import { JsMsg } from 'nats';
import { Order } from '@db/models';
import { log, OrderStatus } from '@jym272ticketing/common/dist/utils';
import { getSequelizeClient } from '@db/sequelize';
import { OrderSubjects, sc, subjects, nakTheMsg } from '@jym272ticketing/common/dist/events';

const sequelize = getSequelizeClient();

// The only UPDATE that has order in orders-api is canceling an order,
// so the versioning has to be validated. OrderCancelled == OrderUpdate(this not exits)

const orderCancelled = async (m: JsMsg, order: Order) => {
  m.working();
  let orderFound: Order | null;
  try {
    orderFound = await Order.findByPk(order.id, { attributes: ['version', 'id'] });
    if (!orderFound) {
      log("Order does not exist, maybe isn't created yet");
      nakTheMsg(m);
      return;
    }
  } catch (err) {
    log('Error processing order', err);
    nakTheMsg(m);
    return;
  }

  if (orderFound.version >= order.version) {
    log('order version received is not greater than the one in the DB');
    m.term();
    return;
  }
  if (orderFound.version + 1 !== order.version) {
    log('order version is not consecutive, maybe a version was not processed yet');
    nakTheMsg(m);
    return;
  }

  try {
    await sequelize.transaction(async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const order = orderFound!;
      order.status = OrderStatus.Cancelled;
      order.version = order.version + 1;
      await order.save();
      // const pa = await publish(order, subjects.OrderCreated); TODO: publish to the interested, it must be in the transaction
      // seq = pa.seq; // The sequence number of the message as stored in JetStream
      m.ack();
    });
  } catch (err) {
    log('Error updating/cancelling the order', err);
    nakTheMsg(m);
    return;
  }
};

export const orderCancelledListener = async (m: JsMsg) => {
  if (m.subject !== subjects.OrderCancelled) {
    log('Wrong subject', m.subject);
    m.term();
    return;
  }
  let order: Order | undefined;
  try {
    const data = JSON.parse(sc.decode(m.data)) as Record<OrderSubjects, Order | undefined>;
    order = data[subjects.OrderCancelled];
    if (!order) throw new Error(`order not found in message data with subject ${m.subject}`);
  } catch (e) {
    log('Error parsing message data', e);
    m.term();
    return;
  }
  await orderCancelled(m, order);
};
