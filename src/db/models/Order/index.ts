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
  declare price: number;
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
