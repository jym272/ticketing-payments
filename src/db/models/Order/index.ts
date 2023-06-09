import {
  Association,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';
import { Payment } from '@db/models';

// only the price is needed, that value can assure that is update, other values can be stored but not used and not updated
// with the actual values in tickets service <- it would need a subscription to the ticket updated event
interface Ticket {
  price: number;
}
export class Order extends Model<
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferAttributes<Order, { omit: 'payment' }>,
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferCreationAttributes<Order, { omit: 'payment' }>
> {
  declare id: number;
  declare userId: number;
  declare status: OrderStatus;
  // is not versioning this Model, is storing the version of the order in Orders Service ->that model is actually versioning
  declare version: number;
  declare ticket: Ticket;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  declare payment?: NonAttribute<Payment>; // Note this is optional since it's only populated when explicitly requested in code

  declare static associations: {
    // eslint-disable-next-line no-use-before-define -- circular dependency allowed
    payment: Association<Order, Payment>;
  };
}
