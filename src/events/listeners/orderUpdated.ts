import { JsMsg } from 'nats';
import { Order } from '@db/models';
import { log } from '@jym272ticketing/common/dist/utils';
import { getSequelizeClient } from '@db/sequelize';
import { OrderSubjects, sc, subjects, nakTheMsg } from '@jym272ticketing/common/dist/events';

const sequelize = getSequelizeClient();

const orderUpdated = async (m: JsMsg, order: Order) => {
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
      /*const updatedTicket =*/ await Order.update(
        {
          status: order.status,
          version: order.version,
          price: order.price,
          userId: order.userId
        },
        {
          where: {
            id: order.id,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- it is not null but the transaction does not assume it
            version: orderFound!.version
          }
        }
      );
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

export const orderUpdatedListener = async (m: JsMsg) => {
  if (m.subject !== subjects.OrderUpdated) {
    log('Wrong subject', m.subject);
    m.term();
    return;
  }
  let order: Order | undefined;
  try {
    const data = JSON.parse(sc.decode(m.data)) as Record<OrderSubjects, Order | undefined>;
    order = data[subjects.OrderUpdated];
    if (!order) throw new Error(`order not found in message data with subject ${m.subject}`);
  } catch (e) {
    log('Error parsing message data', e);
    m.term();
    return;
  }
  await orderUpdated(m, order);
};
