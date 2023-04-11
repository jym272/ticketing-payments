import { DataTypes, Sequelize } from 'sequelize';
import { Order, Payment } from '@db/models';
import { OrderStatus } from '@jym272ticketing/common/dist/utils';

export const init = (sequelize: Sequelize) => {
  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM,
        values: Object.values(OrderStatus),
        allowNull: false
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      price: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        get() {
          return Number(this.getDataValue('price'));
        }
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: 'order'
    }
  );
};

export const associate = () => {
  Order.hasOne(Payment, {
    sourceKey: 'id',
    foreignKey: {
      name: 'orderId',
      allowNull: false
    },
    as: 'payment'
  });
};
