import type { DatabaseSync } from "node:sqlite";
import { commonDishes } from "./commonDishes";

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id INTEGER NOT NULL UNIQUE,
      ingredients TEXT NOT NULL DEFAULT '',
      seasonings TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
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

  backfillCommonDishes(db);
}

function backfillCommonDishes(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const findDish = db.prepare("SELECT id FROM dishes WHERE name = ?");
  const insertDish = db.prepare(`
    INSERT INTO dishes (
      name, category, price, description, estimated_minutes, difficulty,
      is_recommended, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRecipe = db.prepare(`
    INSERT INTO recipes (dish_id, ingredients, seasonings, steps, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
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
      now,
      now
    );
  }
}
