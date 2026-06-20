import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("home ordering api", () => {
  it("lists seeded dishes with recipes", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).get("/api/dishes");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(120);
    expect(response.body[0]).toHaveProperty("recipe");
  });

  it("backfills common dishes without duplicating or overwriting existing dishes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "order-food-"));
    const databasePath = join(dir, "test.sqlite");

    try {
      const app = createApp({ databasePath });
      const firstList = await request(app).get("/api/dishes");
      const tomatoEgg = firstList.body.find((dish: { name: string }) => dish.name === "番茄炒蛋");

      await request(app)
        .put(`/api/dishes/${tomatoEgg.id}`)
        .send({
          ...tomatoEgg,
          price: 99,
          recipe: {
            ...tomatoEgg.recipe,
            steps: "家里自己的做法"
          }
        });

      const restartedApp = createApp({ databasePath });
      const secondList = await request(restartedApp).get("/api/dishes");
      const updatedTomatoEgg = secondList.body.find((dish: { name: string }) => dish.name === "番茄炒蛋");

      expect(secondList.body).toHaveLength(firstList.body.length);
      expect(updatedTomatoEgg.price).toBe(99);
      expect(updatedTomatoEgg.recipe.steps).toBe("家里自己的做法");
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // SQLite can keep a file handle briefly on Windows after the test completes.
      }
    }
  });

  it("creates a dish with a text recipe", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).post("/api/dishes").send({
      name: "番茄炒蛋",
      category: "家常菜",
      price: 18,
      description: "酸甜下饭",
      estimatedMinutes: 12,
      difficulty: "简单",
      isRecommended: true,
      recipe: {
        ingredients: "番茄 2 个，鸡蛋 3 个",
        seasonings: "盐，糖",
        steps: "鸡蛋炒熟盛出；番茄炒软；合炒调味"
      }
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("番茄炒蛋");
    expect(response.body.recipe.steps).toContain("合炒");
  });

  it("creates an order with price snapshots", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const dishes = await request(app).get("/api/dishes");
    const dishId = dishes.body[0].id;

    const response = await request(app).post("/api/orders").send({
      dinersCount: 3,
      note: "少油",
      items: [{ dishId, quantity: 2 }]
    });

    expect(response.status).toBe(201);
    expect(response.body.items[0].dishName).toBe(dishes.body[0].name);
    expect(response.body.totalPrice).toBe(response.body.items[0].subtotal);
  });

  it("marks an order as completed", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const dishes = await request(app).get("/api/dishes");
    const created = await request(app).post("/api/orders").send({
      dinersCount: 1,
      note: "",
      items: [{ dishId: dishes.body[0].id, quantity: 1 }]
    });

    const response = await request(app)
      .patch(`/api/orders/${created.body.id}/status`)
      .send({ status: "completed" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
  });
});
