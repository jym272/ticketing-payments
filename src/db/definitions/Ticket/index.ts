import { DataTypes, Op, Sequelize } from 'sequelize';
import { Order, Ticket } from '@db/models';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';

export const init = (sequelize: Sequelize) => {
  Ticket.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'title'
      },
      price: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        field: 'price',
        get() {
          return Number(this.getDataValue('price'));
        }
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: 'ticket'
    }
  );
};

export const associate = () => {
  Ticket.hasMany(Order, {
    sourceKey: 'id',
    foreignKey: 'ticketId',
    scope: {
      //only affect the mixins
      status: {
        [Op.notIn]: [OrderStatus.Cancelled]
      }
    },
    as: 'reservedOrders'
  });
  Ticket.hasMany(Order, {
    sourceKey: 'id',
    foreignKey: 'ticketId',
    as: 'orders'
  });
};
