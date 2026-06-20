import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

type AppWithDatabase = ReturnType<typeof createApp> & {
  locals: {
    db?: {
      close: () => void;
    };
  };
};

function closeAppDatabase(app: AppWithDatabase | undefined): void {
  app?.locals.db?.close();
}

describe("home ordering api", () => {
  it("lists seeded dishes with recipes", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).get("/api/dishes");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(120);
    expect(response.body[0]).toHaveProperty("recipe");
  });

  it("backfills seeded dishes with a direct video tutorial entry and structured steps", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).get("/api/dishes");
    const kungPaoChicken = response.body.find((dish: { name: string }) => dish.name === "宫保鸡丁");

    expect(kungPaoChicken.recipe.videoUrl).toContain("bilibili.com/video/");
    expect(kungPaoChicken.recipe.videoUrl).not.toContain("search.bilibili.com");
    expect(kungPaoChicken.recipe.stepItems.length).toBeGreaterThanOrEqual(2);
    expect(kungPaoChicken.recipe.stepItems[0].instruction).toContain("鸡腿肉");
  });

  it("backfills common dishes without duplicating or overwriting existing dishes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "order-food-"));
    const databasePath = join(dir, "test.sqlite");
    let app: AppWithDatabase | undefined;
    let restartedApp: AppWithDatabase | undefined;

    try {
      app = createApp({ databasePath }) as AppWithDatabase;
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

      restartedApp = createApp({ databasePath }) as AppWithDatabase;
      const secondList = await request(restartedApp).get("/api/dishes");
      const updatedTomatoEgg = secondList.body.find((dish: { name: string }) => dish.name === "番茄炒蛋");

      expect(secondList.body).toHaveLength(firstList.body.length);
      expect(updatedTomatoEgg.price).toBe(99);
      expect(updatedTomatoEgg.recipe.steps).toBe("家里自己的做法");
    } finally {
      closeAppDatabase(app);
      closeAppDatabase(restartedApp);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // SQLite can keep a file handle briefly on Windows after the test completes.
      }
    }
  });

  it("does not overwrite manually maintained recipe media on restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "order-food-"));
    const databasePath = join(dir, "test.sqlite");
    let app: AppWithDatabase | undefined;
    let restartedApp: AppWithDatabase | undefined;

    try {
      app = createApp({ databasePath }) as AppWithDatabase;
      const firstList = await request(app).get("/api/dishes");
      const kungPaoChicken = firstList.body.find((dish: { name: string }) => dish.name === "宫保鸡丁");

      await request(app)
        .put(`/api/dishes/${kungPaoChicken.id}`)
        .send({
          ...kungPaoChicken,
          recipe: {
            ...kungPaoChicken.recipe,
            videoUrl: "https://example.com/my-kung-pao-video",
            stepItems: [
              { stepOrder: 1, instruction: "自家切丁方式", imagePath: "/uploads/recipes/custom-1.webp" },
              { stepOrder: 2, instruction: "自家调汁方式", imagePath: "" }
            ]
          }
        });

      restartedApp = createApp({ databasePath }) as AppWithDatabase;
      const secondList = await request(restartedApp).get("/api/dishes");
      const updatedKungPaoChicken = secondList.body.find((dish: { name: string }) => dish.name === "宫保鸡丁");

      expect(updatedKungPaoChicken.recipe.videoUrl).toBe("https://example.com/my-kung-pao-video");
      expect(updatedKungPaoChicken.recipe.stepItems).toHaveLength(2);
      expect(updatedKungPaoChicken.recipe.stepItems[0].instruction).toBe("自家切丁方式");
      expect(updatedKungPaoChicken.recipe.stepItems[0].imagePath).toBe("/uploads/recipes/custom-1.webp");
    } finally {
      closeAppDatabase(app);
      closeAppDatabase(restartedApp);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // SQLite can keep a file handle briefly on Windows after the test completes.
      }
    }
  });

  it("upgrades old generated search video links to direct video links on restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "order-food-"));
    const databasePath = join(dir, "test.sqlite");
    let app: AppWithDatabase | undefined;
    let restartedApp: AppWithDatabase | undefined;

    try {
      app = createApp({ databasePath }) as AppWithDatabase;
      const firstList = await request(app).get("/api/dishes");
      const kungPaoChicken = firstList.body.find((dish: { name: string }) => dish.name === "宫保鸡丁");

      await request(app)
        .put(`/api/dishes/${kungPaoChicken.id}`)
        .send({
          ...kungPaoChicken,
          recipe: {
            ...kungPaoChicken.recipe,
            videoUrl: "https://search.bilibili.com/all?keyword=%E5%AE%AB%E4%BF%9D%E9%B8%A1%E4%B8%81%20%E5%81%9A%E6%B3%95"
          }
        });

      restartedApp = createApp({ databasePath }) as AppWithDatabase;
      const secondList = await request(restartedApp).get("/api/dishes");
      const updatedKungPaoChicken = secondList.body.find((dish: { name: string }) => dish.name === "宫保鸡丁");

      expect(updatedKungPaoChicken.recipe.videoUrl).toContain("bilibili.com/video/");
      expect(updatedKungPaoChicken.recipe.videoUrl).not.toContain("search.bilibili.com");
    } finally {
      closeAppDatabase(app);
      closeAppDatabase(restartedApp);
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

  it("creates and updates a dish with cover image, video link, and recipe step items", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const created = await request(app).post("/api/dishes").send({
      name: "图文教程测试菜",
      category: "家常菜",
      price: 20,
      description: "用于测试图文教程",
      estimatedMinutes: 15,
      difficulty: "简单",
      isRecommended: false,
      recipe: {
        ingredients: "鸡蛋，番茄",
        seasonings: "盐",
        steps: "旧文本步骤",
        coverImagePath: "/uploads/recipes/cover.webp",
        videoUrl: "https://example.com/video",
        stepItems: [
          { stepOrder: 1, instruction: "切番茄", imagePath: "/uploads/recipes/step-1.webp" },
          { stepOrder: 2, instruction: "炒鸡蛋", imagePath: "" }
        ]
      }
    });

    expect(created.status).toBe(201);
    expect(created.body.recipe.coverImagePath).toBe("/uploads/recipes/cover.webp");
    expect(created.body.recipe.videoUrl).toBe("https://example.com/video");
    expect(created.body.recipe.stepItems).toHaveLength(2);
    expect(created.body.recipe.stepItems[0].instruction).toBe("切番茄");

    const updated = await request(app)
      .put(`/api/dishes/${created.body.id}`)
      .send({
        ...created.body,
        recipe: {
          ...created.body.recipe,
          videoUrl: "https://example.com/updated",
          stepItems: [{ stepOrder: 1, instruction: "更新后的步骤", imagePath: "" }]
        }
      });

    expect(updated.status).toBe(200);
    expect(updated.body.recipe.videoUrl).toBe("https://example.com/updated");
    expect(updated.body.recipe.stepItems).toHaveLength(1);
    expect(updated.body.recipe.stepItems[0].instruction).toBe("更新后的步骤");
  });

  it("rejects invalid recipe video urls", async () => {
    const app = createApp({ databasePath: ":memory:" });
    const response = await request(app).post("/api/dishes").send({
      name: "非法视频链接",
      category: "家常菜",
      price: 12,
      description: "",
      estimatedMinutes: 10,
      difficulty: "简单",
      isRecommended: false,
      recipe: {
        ingredients: "豆腐",
        seasonings: "盐",
        steps: "煎一下",
        coverImagePath: "",
        videoUrl: "javascript:alert(1)",
        stepItems: [{ stepOrder: 1, instruction: "煎豆腐", imagePath: "" }]
      }
    });

    expect(response.status).toBe(400);
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
