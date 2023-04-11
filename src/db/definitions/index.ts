import { Sequelize } from 'sequelize';

import * as payment from '@db/definitions/Payment';
import * as order from '@db/definitions/Order';

const appLabels = [payment, order];

export const initDefinitions = (sequelize: Sequelize) => {
  for (const label of appLabels) {
    label.init(sequelize);
  }
  for (const label of appLabels) {
    label.associate();
  }
};
