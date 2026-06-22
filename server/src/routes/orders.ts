import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  createOrder,
  createOrderSchema,
  deleteOrder,
  getOrderStats,
  listOrders,
  orderStatsQuerySchema,
  updateOrderStatus,
  updateOrderStatusSchema
} from "../modules/orders";

export function createOrdersRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listOrders(db));
  });

  router.get("/stats", (request, response, next) => {
    try {
      const input = orderStatsQuerySchema.parse(request.query);
      response.json(getOrderStats(db, input));
    } catch (error) {
      next(error);
    }
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

  router.delete("/:id", (request, response) => {
    const deleted = deleteOrder(db, Number(request.params.id));
    if (!deleted) {
      response.status(404).json({ message: "订单不存在" });
      return;
    }
    response.status(204).send();
  });

  return router;
}
