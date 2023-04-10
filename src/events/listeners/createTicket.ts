import { JsMsg } from 'nats';
import { Ticket } from '@db/models';
import { log, getEnvOrFail } from '@jym272ticketing/common/dist/utils';
import { getSequelizeClient } from '@db/sequelize';
import { sc, subjects, TicketSubjects } from '@jym272ticketing/common/dist/events';

const sequelize = getSequelizeClient();
const nackDelay = getEnvOrFail('NACK_DELAY_MS');

const createTicket = async (m: JsMsg, ticket: Ticket) => {
  m.working();
  if (ticket.version !== 0) {
    // TODO: error LOG
    log('Ticket version is not 0');
    m.term();
    return;
  }
  try {
    const tk = await Ticket.findByPk(ticket.id, { attributes: ['id'] });
    if (tk) {
      log('Ticket already exists, did you mean to update it?');
      m.term();
      return;
    }
  } catch (err) {
    log('Error processing ticket', err);
    m.nak(Number(nackDelay));
    return;
  }
  try {
    await sequelize.transaction(async () => {
      /*const newTicket =*/ await Ticket.create({
        id: ticket.id,
        title: ticket.title,
        price: ticket.price,
        version: ticket.version
      });
      // const pa = await publish(order, subjects.OrderCreated); TODO: publish to the interested, it must be in the transaction
      // seq = pa.seq; // The sequence number of the message as stored in JetStream
      m.ack();
    });
  } catch (e) {
    log('Error creating ticket', e);
    m.nak(Number(nackDelay));
    return;
  }
};

export const createTicketListener = async (m: JsMsg) => {
  if (m.subject !== subjects.TicketCreated) {
    log('Wrong subject', m.subject);
    m.term();
    return;
  }
  let ticket: Ticket | undefined;
  try {
    const data = JSON.parse(sc.decode(m.data)) as Record<TicketSubjects, Ticket | undefined>;
    ticket = data[subjects.TicketCreated];
    if (!ticket) throw new Error(`Ticket not found in message data with subject ${m.subject}`);
  } catch (e) {
    log('Error parsing message data', e);
    m.term();
    return;
  }
  await createTicket(m, ticket);
};
