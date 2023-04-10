import { initializeSetup, startSetup } from './setup';
import { utils } from '@jym272ticketing/common';
const { log, successConnectionMsg } = utils;
import { getEnvOrFail, rocketEmoji } from '@utils/index';
import { createTicketListener, updateTicketListener, expirationCompleteListener } from '@events/index';
import { nc, startJetStream, Streams, subjects, subscribe } from '@jym272ticketing/common/dist/events';

const { server } = initializeSetup();

const PORT = getEnvOrFail('PORT');

void (async () => {
  try {
    await startJetStream({
      streams: [Streams.ORDERS, Streams.TICKETS, Streams.EXPIRATION],
      nats: {
        url: `nats://${getEnvOrFail('NATS_SERVER_HOST')}:${getEnvOrFail('NATS_SERVER_PORT')}`
      }
    });
    await startSetup(server);
    server.listen(PORT, () => successConnectionMsg(`${rocketEmoji} Server is running on port ${PORT}`));
    // TODO: logs red and green and yellow with chalk
    void subscribe(subjects.TicketCreated, createTicketListener);
    void subscribe(subjects.TicketUpdated, updateTicketListener);
    void subscribe(subjects.ExpirationComplete, expirationCompleteListener);
  } catch (error) {
    log(error);
    process.exitCode = 1;
  }
})();

const listener = async () => {
  if (nc) {
    await nc.drain();
    log('NATS connection drained');
  }
  process.exit();
};

process.on('SIGINT', listener);
process.on('SIGTERM', listener);
