import { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute } from 'sequelize';
import { Order } from '@db/models';
import Stripe from 'stripe';

export class Payment extends Model<
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferAttributes<Payment, { omit: 'order' }>,
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferCreationAttributes<Payment, { omit: 'order' }>
> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare stripeCharge: Stripe.Charge;
  declare orderId: ForeignKey<Order['id']>;
  declare order?: NonAttribute<Order>;
}
