import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  createDish,
  deleteDish,
  dishInputSchema,
  listDishes,
  updateDish,
  updateDishFavorite,
  updateDishFavoriteSchema
} from "../modules/dishes";

export function createDishesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listDishes(db));
  });

  router.post("/", (request, response, next) => {
    try {
      const input = dishInputSchema.parse(request.body);
      response.status(201).json(createDish(db, input));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", (request, response, next) => {
    try {
      const input = dishInputSchema.parse(request.body);
      const dish = updateDish(db, Number(request.params.id), input);
      if (!dish) {
        response.status(404).json({ message: "菜品不存在" });
        return;
      }
      response.json(dish);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/favorite", (request, response, next) => {
    try {
      const input = updateDishFavoriteSchema.parse(request.body);
      const dish = updateDishFavorite(db, Number(request.params.id), input.isFavorite);
      if (!dish) {
        response.status(404).json({ message: "菜品不存在" });
        return;
      }
      response.json(dish);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", (request, response) => {
    const deleted = deleteDish(db, Number(request.params.id));
    if (!deleted) {
      response.status(404).json({ message: "菜品不存在" });
      return;
    }
    response.status(204).send();
  });

  return router;
}
