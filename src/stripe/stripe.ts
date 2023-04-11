import Stripe from 'stripe';
import { getEnvOrFail } from '@utils/env';

const apiKey = getEnvOrFail('STRIPE_SECRET_KEY');

let stripeInstance: Stripe | null = null;

export const getStripeClient = () => {
  if (stripeInstance) {
    return stripeInstance;
  }
  stripeInstance = new Stripe(apiKey, {
    apiVersion: '2022-11-15'
  });
  return stripeInstance;
};

export const createStripeClient = () => getStripeClient();
