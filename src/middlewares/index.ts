import express from 'express';
import { addExpressMiddlewares } from '@middlewares/express';
import { addCookieSessionMiddlewares } from '@middlewares/cookieSession';

export const addMiddlewares = (server: express.Express) => {
  addCookieSessionMiddlewares(server);
  addExpressMiddlewares(server);
};
