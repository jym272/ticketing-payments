import { initializeSetup, startSetup } from './setup';
import { utils } from '@jym272ticketing/common';
const { log, successConnectionMsg } = utils;
import { getEnvOrFail, rocketEmoji } from '@utils/index';
import { orderCreatedListener, orderUpdatedListener } from '@events/index';
import { nc, startJetStream, Streams, subjects, subscribe } from '@jym272ticketing/common/dist/events';
import { createStripeClient } from '@stripe/stripe';

const { server } = initializeSetup();

const PORT = getEnvOrFail('PORT');
// some comment
void (async () => {
  const queueGroupName = 'payments-service';
  try {
    await startJetStream({
      queueGroupName,
      streams: [Streams.ORDERS, Streams.PAYMENTS],
      nats: {
        url: `nats://${getEnvOrFail('NATS_SERVER_HOST')}:${getEnvOrFail('NATS_SERVER_PORT')}`
      }
    });
    await startSetup(server);
    createStripeClient();
    server.listen(PORT, () => successConnectionMsg(`${rocketEmoji} Server is running on port ${PORT}`));
    void subscribe(subjects.OrderCreated, queueGroupName, orderCreatedListener);
    void subscribe(subjects.OrderUpdated, queueGroupName, orderUpdatedListener);
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
