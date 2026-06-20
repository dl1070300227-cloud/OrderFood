import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  createOrder,
  createOrderSchema,
  listOrders,
  updateOrderStatus,
  updateOrderStatusSchema
} from "../modules/orders";

export function createOrdersRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listOrders(db));
  });

  router.post("/", (request, response, next) => {
    try {
      const input = createOrderSchema.parse(request.body);
      response.status(201).json(createOrder(db, input));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", (request, response, next) => {
    try {
      const input = updateOrderStatusSchema.parse(request.body);
      const order = updateOrderStatus(db, Number(request.params.id), input.status);
      if (!order) {
        response.status(404).json({ message: "订单不存在" });
        return;
      }
      response.json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
