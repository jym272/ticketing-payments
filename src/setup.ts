import express from 'express';
import 'express-async-errors';
import { addRoutes } from '@routes/index';
import { addMiddlewares } from '@middlewares/index';
import { createSequelize, initializeSequelize } from '@db/sequelize';
import { commonController } from '@jym272ticketing/common';

const createServer = (): express.Express => {
  return express();
};

const createExpress = () => createServer();

export const initializeSetup = () => {
  const server = createExpress();
  return {
    server
  };
};

// otherwise the cookie will not be sent over https connection
const configureServer = (server: express.Express) => {
  server.set('trust proxy', true);
};

export const startSetup = async (server: express.Express) => {
  const sequelize = createSequelize();
  await initializeSequelize(sequelize);
  configureServer(server);
  addMiddlewares(server);
  addRoutes(server);
  server.use(commonController.errorHandler);
};
