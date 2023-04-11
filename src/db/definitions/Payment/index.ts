import { DataTypes, Sequelize } from 'sequelize';
import { Order, Payment } from '@db/models';

export const init = (sequelize: Sequelize) => {
  Payment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      stripeCharge: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    },
    {
      sequelize,
      tableName: 'payment'
    }
  );
};

export const associate = () => {
  Payment.belongsTo(Order);
};
