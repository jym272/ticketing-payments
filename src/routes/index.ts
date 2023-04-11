import express from 'express';
import { payment } from '@routes/payment';
import { routes as commonRoutes } from '@jym272ticketing/common';
const { utils, home } = commonRoutes;

const routes = [home, payment, utils];

export const addRoutes = (server: express.Express) => {
  for (const route of routes) {
    server.use(route);
  }
};
