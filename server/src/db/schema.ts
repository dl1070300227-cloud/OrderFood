import type { DatabaseSync } from "node:sqlite";
import { commonDishes, defaultCoverImagesByCategory } from "./commonDishes";
import { recipeVideos } from "./recipeVideos";

export function initializeDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL CHECK (price >= 0),
      description TEXT NOT NULL DEFAULT '',
      estimated_minutes INTEGER,
      difficulty TEXT NOT NULL DEFAULT '',
      is_recommended INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id INTEGER NOT NULL UNIQUE,
      ingredients TEXT NOT NULL DEFAULT '',
      seasonings TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '',
      cover_image_path TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      step_order INTEGER NOT NULL CHECK (step_order >= 1),
      instruction TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordered_at TEXT NOT NULL,
      diners_count INTEGER NOT NULL CHECK (diners_count >= 1),
      note TEXT NOT NULL DEFAULT '',
      total_price REAL NOT NULL CHECK (total_price >= 0),
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dish_id INTEGER,
      dish_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      subtotal REAL NOT NULL CHECK (subtotal >= 0),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL
    );
  `);

  ensureDishPreferenceColumns(db);
  ensureRecipeMediaColumns(db);
  backfillCommonDishes(db);
  backfillRecipeSteps(db);
  backfillDefaultCoverImages(db);
}

function ensureDishPreferenceColumns(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(dishes)").all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("is_favorite")) {
    db.exec("ALTER TABLE dishes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0");
  }
}

function ensureRecipeMediaColumns(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(recipes)").all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("cover_image_path")) {
    db.exec("ALTER TABLE recipes ADD COLUMN cover_image_path TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("video_url")) {
    db.exec("ALTER TABLE recipes ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");
  }
}

function backfillCommonDishes(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const findDish = db.prepare("SELECT id FROM dishes WHERE name = ?");
  const insertDish = db.prepare(`
    INSERT INTO dishes (
      name, category, price, description, estimated_minutes, difficulty,
      is_recommended, is_favorite, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);
  const insertRecipe = db.prepare(`
    INSERT INTO recipes (
      dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const dish of commonDishes) {
    const existing = findDish.get(dish.name) as { id: number } | undefined;
    if (existing) {
      continue;
    }

    const result = insertDish.run(
      dish.name,
      dish.category,
      dish.price,
      dish.description,
      dish.estimatedMinutes,
      dish.difficulty,
      dish.isRecommended ? 1 : 0,
      now,
      now
    );
    insertRecipe.run(
      Number(result.lastInsertRowid),
      dish.recipe.ingredients,
      dish.recipe.seasonings,
      dish.recipe.steps,
      dish.recipe.coverImagePath,
      buildRecipeVideoUrl(dish.name),
      now,
      now
    );
  }
}

function backfillDefaultCoverImages(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const findRecipe = db.prepare(`
    SELECT r.id, r.cover_image_path
    FROM recipes r
    INNER JOIN dishes d ON d.id = r.dish_id
    WHERE d.name = ?
  `);
  const updateCover = db.prepare("UPDATE recipes SET cover_image_path = ?, updated_at = ? WHERE id = ?");
  const categoryDefaultImages = new Set(Object.values(defaultCoverImagesByCategory));

  for (const dish of commonDishes) {
    const recipe = findRecipe.get(dish.name) as { id: number; cover_image_path: string } | undefined;
    if (!recipe) {
      continue;
    }
    if (recipe.cover_image_path.trim() && !categoryDefaultImages.has(recipe.cover_image_path)) {
      continue;
    }
    updateCover.run(dish.recipe.coverImagePath, now, recipe.id);
  }
}

function backfillRecipeSteps(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const findRecipe = db.prepare(`
    SELECT r.id, r.steps
    FROM recipes r
    INNER JOIN dishes d ON d.id = r.dish_id
    WHERE d.name = ?
  `);
  const findSteps = db.prepare(`
    SELECT instruction, image_path
    FROM recipe_steps
    WHERE recipe_id = ?
    ORDER BY step_order ASC, id ASC
  `);
  const deleteSteps = db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?");
  const insertStep = db.prepare(`
    INSERT INTO recipe_steps (recipe_id, step_order, instruction, image_path, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?)
  `);
  const updateVideo = db.prepare(`
    UPDATE recipes
    SET video_url = ?, updated_at = ?
    WHERE id = ?
      AND (
        TRIM(video_url) = ''
        OR video_url LIKE 'https://search.bilibili.com/%'
        OR video_url LIKE 'http://search.bilibili.com/%'
      )
  `);

  for (const dish of commonDishes) {
    const recipe = findRecipe.get(dish.name) as { id: number; steps: string } | undefined;
    if (!recipe) {
      continue;
    }

    updateVideo.run(buildRecipeVideoUrl(dish.name), now, recipe.id);

    const existingSteps = findSteps.all(recipe.id) as Array<{ instruction: string; image_path: string }>;
    const canReplaceDefaultStep =
      existingSteps.length === 0 ||
      (existingSteps.length === 1 &&
        existingSteps[0].image_path.trim() === "" &&
        existingSteps[0].instruction.trim() === recipe.steps.trim());

    if (!canReplaceDefaultStep) {
      continue;
    }

    const nextSteps = splitRecipeSteps(recipe.steps);
    deleteSteps.run(recipe.id);
    nextSteps.forEach((instruction, index) => {
      insertStep.run(recipe.id, index + 1, instruction, now, now);
    });
  }

  const recipes = db
    .prepare(
      `
      SELECT r.id, r.steps
      FROM recipes r
      WHERE TRIM(r.steps) != ''
        AND NOT EXISTS (
          SELECT 1 FROM recipe_steps rs WHERE rs.recipe_id = r.id
        )
    `
    )
    .all() as Array<{ id: number; steps: string }>;

  for (const recipe of recipes) {
    splitRecipeSteps(recipe.steps).forEach((instruction, index) => {
      insertStep.run(recipe.id, index + 1, instruction, now, now);
    });
  }
}

function buildRecipeVideoUrl(dishName: string): string {
  const video = recipeVideos[dishName];
  if (video) {
    return video.url;
  }
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${dishName} 做法`)}`;
}

function splitRecipeSteps(steps: string): string[] {
  const normalized = steps.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/[；;。.\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}
