import { Request, Response } from 'express';
import { getSequelizeClient, Order, Ticket } from '@db/index';
import { utils } from '@jym272ticketing/common';
const { httpStatusCodes, throwError, parseSequelizeError } = utils;
const { OK, INTERNAL_SERVER_ERROR } = httpStatusCodes;
const sequelize = getSequelizeClient();

export const getOrdersController = () => {
  return async (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- because of requireAuth middleware
    const currentUser = req.currentUser!;
    const userId = currentUser.jti;

    try {
      const orders = await sequelize.transaction(async () => {
        return await Order.findAll({
          where: {
            userId: Number(userId)
          },
          include: [
            {
              model: Ticket,
              as: 'ticket'
            }
          ]
        });
      });
      return res.status(OK).json(orders);
    } catch (err) {
      const error = parseSequelizeError(err, `Getting Orders failed. currentUser ${JSON.stringify(currentUser)}`);
      throwError('Getting Orders failed.', INTERNAL_SERVER_ERROR, error);
    }
  };
};
