import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export type Recipe = {
  ingredients: string;
  seasonings: string;
  steps: string;
};

export type Dish = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  estimatedMinutes: number | null;
  difficulty: string;
  isRecommended: boolean;
  recipe: Recipe;
};

type DishRow = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  estimated_minutes: number | null;
  difficulty: string;
  is_recommended: number;
  ingredients: string | null;
  seasonings: string | null;
  steps: string | null;
};

export const dishInputSchema = z.object({
  name: z.string().trim().min(1, "菜名不能为空"),
  category: z.string().trim().default(""),
  price: z.number().min(0, "价格必须是非负数字"),
  description: z.string().trim().default(""),
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
  difficulty: z.string().trim().default(""),
  isRecommended: z.boolean().default(false),
  recipe: z.object({
    ingredients: z.string().default(""),
    seasonings: z.string().default(""),
    steps: z.string().default("")
  })
});

export type DishInput = z.infer<typeof dishInputSchema>;

function mapDish(row: DishRow): Dish {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    description: row.description,
    estimatedMinutes: row.estimated_minutes,
    difficulty: row.difficulty,
    isRecommended: row.is_recommended === 1,
    recipe: {
      ingredients: row.ingredients ?? "",
      seasonings: row.seasonings ?? "",
      steps: row.steps ?? ""
    }
  };
}

export function listDishes(db: DatabaseSync): Dish[] {
  const rows = db
    .prepare(
      `
      SELECT
        d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, r.ingredients, r.seasonings, r.steps
      FROM dishes d
      LEFT JOIN recipes r ON r.dish_id = d.id
      ORDER BY d.is_recommended DESC, d.name ASC
    `
    )
    .all() as DishRow[];
  return rows.map(mapDish);
}

export function getDish(db: DatabaseSync, id: number): Dish | null {
  const row = db
    .prepare(
      `
      SELECT
        d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, r.ingredients, r.seasonings, r.steps
      FROM dishes d
      LEFT JOIN recipes r ON r.dish_id = d.id
      WHERE d.id = ?
    `
    )
    .get(id) as DishRow | undefined;
  return row ? mapDish(row) : null;
}

export function createDish(db: DatabaseSync, input: DishInput): Dish {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
      INSERT INTO dishes (
        name, category, price, description, estimated_minutes, difficulty,
        is_recommended, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      input.name,
      input.category,
      input.price,
      input.description,
      input.estimatedMinutes ?? null,
      input.difficulty,
      input.isRecommended ? 1 : 0,
      now,
      now
    );

  const id = Number(result.lastInsertRowid);
  db.prepare(
    `
    INSERT INTO recipes (dish_id, ingredients, seasonings, steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(id, input.recipe.ingredients, input.recipe.seasonings, input.recipe.steps, now, now);

  const dish = getDish(db, id);
  if (!dish) {
    throw new Error("创建菜品失败");
  }
  return dish;
}

export function updateDish(db: DatabaseSync, id: number, input: DishInput): Dish | null {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
      UPDATE dishes
      SET name = ?, category = ?, price = ?, description = ?, estimated_minutes = ?,
          difficulty = ?, is_recommended = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(
      input.name,
      input.category,
      input.price,
      input.description,
      input.estimatedMinutes ?? null,
      input.difficulty,
      input.isRecommended ? 1 : 0,
      now,
      id
    );

  if (result.changes === 0) {
    return null;
  }

  db.prepare(
    `
    INSERT INTO recipes (dish_id, ingredients, seasonings, steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(dish_id) DO UPDATE SET
      ingredients = excluded.ingredients,
      seasonings = excluded.seasonings,
      steps = excluded.steps,
      updated_at = excluded.updated_at
  `
  ).run(id, input.recipe.ingredients, input.recipe.seasonings, input.recipe.steps, now, now);

  return getDish(db, id);
}

export function deleteDish(db: DatabaseSync, id: number): boolean {
  const result = db.prepare("DELETE FROM dishes WHERE id = ?").run(id);
  return result.changes > 0;
}
