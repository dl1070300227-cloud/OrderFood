import { describe, expect, it } from "vitest";
import { handleApi } from "../src/index";

class FakeD1Statement {
  private params: unknown[] = [];

  constructor(private readonly sql: string) {}

  bind(...params: unknown[]): this {
    this.params = params;
    return this;
  }

  async first() {
    if (this.sql.includes("seeded_common_dishes_v2")) {
      return { value: "true" };
    }
    return null;
  }

  async all() {
    if (this.sql.includes("FROM dishes d")) {
      return {
        results: [
          {
            id: 1,
            name: "番茄炒蛋",
            category: "家常菜",
            price: 18,
            description: "",
            estimated_minutes: 12,
            difficulty: "简单",
            is_recommended: 1,
            is_favorite: 0,
            ingredients: "番茄、鸡蛋",
            seasonings: "盐",
            steps: "炒熟",
            cover_image_path: "",
            video_url: ""
          },
          {
            id: 2,
            name: "青椒肉丝",
            category: "家常菜",
            price: 22,
            description: "",
            estimated_minutes: 15,
            difficulty: "简单",
            is_recommended: 0,
            is_favorite: 0,
            ingredients: "猪肉、青椒",
            seasonings: "盐",
            steps: "炒熟",
            cover_image_path: "",
            video_url: ""
          }
        ]
      };
    }
    if (this.sql.includes("FROM recipe_steps")) {
      const steps = [
        { dish_id: 1, id: 1, step_order: 1, instruction: "炒鸡蛋", image_path: "" },
        { dish_id: 2, id: 2, step_order: 1, instruction: "炒肉丝", image_path: "" }
      ];
      if (this.sql.includes("WHERE r.dish_id = ?")) {
        return { results: steps.filter((step) => step.dish_id === this.params[0]) };
      }
      return {
        results: steps
      };
    }
    return { results: [] };
  }

  async run() {
    return { meta: { last_row_id: 1 } };
  }
}

function createStrictExecD1(): D1Database {
  let prepareCount = 0;
  return {
    get prepareCount() {
      return prepareCount;
    },
    async exec(sql: string) {
      if (sql.includes("\n")) {
        throw new Error("D1_EXEC_ERROR: incomplete input");
      }
      return { count: 1, duration: 0 };
    },
    prepare(sql: string) {
      prepareCount += 1;
      return new FakeD1Statement(sql);
    }
  } as unknown as D1Database;
}

describe("handleApi", () => {
  it("initializes D1 with single statements before listing dishes", async () => {
    const db = createStrictExecD1() as D1Database & { prepareCount: number };
    const response = await handleApi({ DB: db }, new Request("https://example.com/api/dishes", { method: "GET" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0].recipe.stepItems).toEqual([{ id: 1, stepOrder: 1, instruction: "炒鸡蛋", imagePath: "" }]);
    expect(db.prepareCount).toBeLessThanOrEqual(3);
  });
});
