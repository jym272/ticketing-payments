import express from 'express';
import { order } from '@routes/order';
import { routes as commonRoutes } from '@jym272ticketing/common';
const { utils, home } = commonRoutes;

const routes = [home, order, utils];

export const addRoutes = (server: express.Express) => {
  for (const route of routes) {
    server.use(route);
  }
};
