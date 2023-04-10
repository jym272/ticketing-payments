import { createAOrderController } from '@controllers/order/createAOrder';
import { getOrdersController } from '@controllers/order/getOrders';
import { getOrderController } from '@controllers/order/getOrder';
import { cancelOrderController } from '@controllers/order/cancelOrder';

export const orderController = {
  createAOrder: createAOrderController(),
  getOrders: getOrdersController(),
  getOrder: getOrderController(),
  cancelOrder: cancelOrderController()
};
