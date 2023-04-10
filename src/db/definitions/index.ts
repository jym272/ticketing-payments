import { Sequelize } from 'sequelize';

import * as ticket from '@db/definitions/Ticket';
import * as order from '@db/definitions/Order';

const appLabels = [ticket, order];

export const initDefinitions = (sequelize: Sequelize) => {
  for (const label of appLabels) {
    label.init(sequelize);
  }
  for (const label of appLabels) {
    label.associate();
  }
};
