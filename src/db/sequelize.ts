import { Sequelize } from 'sequelize';
import { createNamespace } from 'cls-hooked';
import { initDefinitions } from '@db/definitions';
import { config } from '@utils/sequelize';
import { utils } from '@jym272ticketing/common';
const { activateLogging, log } = utils;
const namespace = createNamespace('transaction-namespace');
Sequelize.useCLS(namespace);

let sequelizeInstance: Sequelize | null = null;

export const getSequelizeClient = () => {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }
  sequelizeInstance = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    dialect: 'postgres',
    logging: activateLogging() ? log : false,
    port: Number(config.db.port),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  return sequelizeInstance;
};

export const createSequelize = () => getSequelizeClient();

export const initializeSequelize = async (sequelize: Sequelize) => {
  await sequelize.authenticate();
  initDefinitions(sequelize);
  await sequelize.sync();
};
