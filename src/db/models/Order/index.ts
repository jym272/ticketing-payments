import { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute } from 'sequelize';
import { Ticket } from '@db/models';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';

// eslint-disable-next-line no-use-before-define -- circular dependency allowed
export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare status: CreationOptional<OrderStatus>;
  declare expiresAt: Date;
  declare ticketId: ForeignKey<Ticket['id']>;
  declare ticket?: NonAttribute<Ticket>;
  declare version: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
