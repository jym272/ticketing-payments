import { JsMsg } from 'nats';
import { Ticket } from '@db/models';
import { log, getEnvOrFail } from '@jym272ticketing/common/dist/utils';
import { getSequelizeClient } from '@db/sequelize';
import { sc, subjects, TicketSubjects } from '@jym272ticketing/common/dist/events';

const sequelize = getSequelizeClient();
const nackDelay = getEnvOrFail('NACK_DELAY_MS');

const updateTicket = async (m: JsMsg, ticket: Ticket) => {
  m.working();
  let tk: Ticket | null;
  try {
    tk = await Ticket.findByPk(ticket.id, { attributes: ['version'] });
    if (!tk) {
      log("Ticket does not exist, maybe isn't created yet");
      m.nak(Number(nackDelay));
      return;
    }
  } catch (err) {
    log('Error processing ticket', err);
    m.nak(Number(nackDelay));
    return;
  }

  if (tk.version >= ticket.version) {
    log('TK', 'Ticket version is not greater than the one in the DB');
    m.term();
    return;
  }
  if (tk.version + 1 !== ticket.version) {
    log('TK', 'Ticket version is not consecutive, maybe a version was not processed yet');
    m.nak(Number(nackDelay));
    return;
  }

  try {
    await sequelize.transaction(async () => {
      /*const updatedTicket =*/ await Ticket.update(
        {
          title: ticket.title,
          price: ticket.price,
          version: ticket.version
        },
        {
          where: {
            id: ticket.id,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- it is not null but the transaction does not assume it
            version: tk!.version
          }
        }
      );
      // const pa = await publish(order, subjects.OrderCreated); TODO: publish to the interested, it must be in the transaction
      // seq = pa.seq; // The sequence number of the message as stored in JetStream
      m.ack();
    });
  } catch (err) {
    log('Error updating ticket', err);
    m.nak(Number(nackDelay));
    return;
  }
};

export const updateTicketListener = async (m: JsMsg) => {
  if (m.subject !== subjects.TicketUpdated) {
    log('Wrong subject', m.subject);
    m.term();
    return;
  }
  let ticket: Ticket | undefined;
  try {
    const data = JSON.parse(sc.decode(m.data)) as Record<TicketSubjects, Ticket | undefined>;
    ticket = data[subjects.TicketUpdated];
    if (!ticket) throw new Error(`Ticket not found in message data with subject ${m.subject}`);
  } catch (e) {
    log('Error parsing message data', e);
    m.term();
    return;
  }
  await updateTicket(m, ticket);
};
