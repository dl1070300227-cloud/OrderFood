import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export type Recipe = {
  ingredients: string;
  seasonings: string;
  steps: string;
  coverImagePath: string;
  videoUrl: string;
  stepItems: RecipeStep[];
};

export type RecipeStep = {
  id?: number;
  stepOrder: number;
  instruction: string;
  imagePath: string;
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
  cover_image_path: string | null;
  video_url: string | null;
};

type RecipeStepRow = {
  id: number;
  step_order: number;
  instruction: string;
  image_path: string;
};

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || value.startsWith("http://") || value.startsWith("https://"), {
    message: "视频链接必须以 http:// 或 https:// 开头"
  });

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
    steps: z.string().default(""),
    coverImagePath: z.string().default(""),
    videoUrl: optionalHttpUrlSchema,
    stepItems: z
      .array(
        z.object({
          id: z.number().int().positive().optional(),
          stepOrder: z.number().int().min(1),
          instruction: z.string().default(""),
          imagePath: z.string().default("")
        })
      )
      .default([])
  })
});

export type DishInput = z.infer<typeof dishInputSchema>;

function getRecipeSteps(db: DatabaseSync, dishId: number): RecipeStep[] {
  const rows = db
    .prepare(
      `
      SELECT rs.id, rs.step_order, rs.instruction, rs.image_path
      FROM recipe_steps rs
      INNER JOIN recipes r ON r.id = rs.recipe_id
      WHERE r.dish_id = ?
      ORDER BY rs.step_order ASC, rs.id ASC
    `
    )
    .all(dishId) as RecipeStepRow[];

  return rows.map((row) => ({
    id: row.id,
    stepOrder: row.step_order,
    instruction: row.instruction,
    imagePath: row.image_path
  }));
}

function mapDish(db: DatabaseSync, row: DishRow): Dish {
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
      steps: row.steps ?? "",
      coverImagePath: row.cover_image_path ?? "",
      videoUrl: row.video_url ?? "",
      stepItems: getRecipeSteps(db, row.id)
    }
  };
}

export function listDishes(db: DatabaseSync): Dish[] {
  const rows = db
    .prepare(
      `
      SELECT
        d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, r.ingredients, r.seasonings, r.steps,
        r.cover_image_path, r.video_url
      FROM dishes d
      LEFT JOIN recipes r ON r.dish_id = d.id
      ORDER BY d.is_recommended DESC, d.name ASC
    `
    )
    .all() as DishRow[];
  return rows.map((row) => mapDish(db, row));
}

export function getDish(db: DatabaseSync, id: number): Dish | null {
  const row = db
    .prepare(
      `
      SELECT
        d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, r.ingredients, r.seasonings, r.steps,
        r.cover_image_path, r.video_url
      FROM dishes d
      LEFT JOIN recipes r ON r.dish_id = d.id
      WHERE d.id = ?
    `
    )
    .get(id) as DishRow | undefined;
  return row ? mapDish(db, row) : null;
}

function normalizeRecipeSteps(input: DishInput): RecipeStep[] {
  const provided = input.recipe.stepItems
    .filter((step) => step.instruction.trim() !== "" || step.imagePath.trim() !== "")
    .map((step, index) => ({
      stepOrder: index + 1,
      instruction: step.instruction.trim(),
      imagePath: step.imagePath.trim()
    }));

  if (provided.length > 0) {
    return provided;
  }

  const fallback = input.recipe.steps.trim();
  return fallback ? [{ stepOrder: 1, instruction: fallback, imagePath: "" }] : [];
}

function replaceRecipeSteps(db: DatabaseSync, dishId: number, input: DishInput, now: string): void {
  const recipe = db.prepare("SELECT id FROM recipes WHERE dish_id = ?").get(dishId) as { id: number } | undefined;
  if (!recipe) {
    return;
  }

  db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").run(recipe.id);
  const insertStep = db.prepare(
    `
    INSERT INTO recipe_steps (recipe_id, step_order, instruction, image_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  );

  for (const step of normalizeRecipeSteps(input)) {
    insertStep.run(recipe.id, step.stepOrder, step.instruction, step.imagePath, now, now);
  }
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
    INSERT INTO recipes (
      dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    input.recipe.ingredients,
    input.recipe.seasonings,
    input.recipe.steps,
    input.recipe.coverImagePath,
    input.recipe.videoUrl,
    now,
    now
  );
  replaceRecipeSteps(db, id, input, now);

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
    INSERT INTO recipes (
      dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dish_id) DO UPDATE SET
      ingredients = excluded.ingredients,
      seasonings = excluded.seasonings,
      steps = excluded.steps,
      cover_image_path = excluded.cover_image_path,
      video_url = excluded.video_url,
      updated_at = excluded.updated_at
  `
  ).run(
    id,
    input.recipe.ingredients,
    input.recipe.seasonings,
    input.recipe.steps,
    input.recipe.coverImagePath,
    input.recipe.videoUrl,
    now,
    now
  );
  replaceRecipeSteps(db, id, input, now);

  return getDish(db, id);
}

export function deleteDish(db: DatabaseSync, id: number): boolean {
  const result = db.prepare("DELETE FROM dishes WHERE id = ?").run(id);
  return result.changes > 0;
}
