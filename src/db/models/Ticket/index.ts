import {
  Association,
  CreationOptional,
  HasManyGetAssociationsMixin,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Op
} from 'sequelize';
import { Order } from '@db/models';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';

export class Ticket extends Model<
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferAttributes<Ticket, { omit: 'orders' }>,
  // eslint-disable-next-line no-use-before-define -- circular dependency allowed
  InferCreationAttributes<Ticket, { omit: 'orders' }>
> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare price: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  // is not versioning this Model, is storing the version of the ticket in Tickets Service ->that model is actually versioning
  declare version: number;
  declare isReserved: CreationOptional<() => Promise<boolean>>;
  // association in init as: 'reservedOrders', affects only mixins with '*ReservedOrders'
  declare getReservedOrders: HasManyGetAssociationsMixin<Order>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  declare orders?: NonAttribute<Order[]>; // Note this is optional since it's only populated when explicitly requested in code

  declare static associations: {
    // eslint-disable-next-line no-use-before-define -- circular dependency allowed
    orders: Association<Ticket, Order>;
  };
}

Ticket.prototype.isReserved = async function () {
  const existingOrder = await Order.findOne({
    where: {
      ticketId: this.id,
      status: {
        [Op.notIn]: [OrderStatus.Cancelled]
      }
    }
  });
  return !!existingOrder;
};
