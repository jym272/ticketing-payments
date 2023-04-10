import { DataTypes, Sequelize } from 'sequelize';
import { Order, Ticket } from '@db/models';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';

export const init = (sequelize: Sequelize) => {
  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM,
        values: Object.values(OrderStatus),
        allowNull: false,
        field: 'status',
        defaultValue: OrderStatus.Created
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
          const expiresAt = this.getDataValue('expiresAt');
          return expiresAt.toISOString();
        }
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: 'order',
      version: true
    }
  );
};

export const associate = () => {
  Order.belongsTo(Ticket, {
    foreignKey: 'ticketId',
    as: 'ticket'
  });
};
