import type { DatabaseSync } from "node:sqlite";

const seedDishes = [
  {
    name: "番茄炒蛋",
    category: "家常菜",
    price: 18,
    description: "酸甜下饭，适合快速开饭",
    estimatedMinutes: 12,
    difficulty: "简单",
    isRecommended: true,
    recipe: {
      ingredients: "番茄 2 个，鸡蛋 3 个",
      seasonings: "盐、糖、葱花",
      steps: "鸡蛋打散炒熟盛出；番茄炒软出汁；倒回鸡蛋合炒并调味。"
    }
  },
  {
    name: "青椒土豆丝",
    category: "素菜",
    price: 12,
    description: "清爽脆口的家常素菜",
    estimatedMinutes: 15,
    difficulty: "简单",
    isRecommended: false,
    recipe: {
      ingredients: "土豆 2 个，青椒 1 个",
      seasonings: "盐、醋、蒜末",
      steps: "土豆切丝泡水；青椒切丝；热锅炒香蒜末，加入土豆丝和青椒快炒调味。"
    }
  },
  {
    name: "可乐鸡翅",
    category: "荤菜",
    price: 32,
    description: "甜咸适中，孩子也爱吃",
    estimatedMinutes: 30,
    difficulty: "中等",
    isRecommended: true,
    recipe: {
      ingredients: "鸡翅中 8 个，可乐 1 罐",
      seasonings: "生抽、老抽、姜片",
      steps: "鸡翅划口焯水；煎至两面微黄；加入调料和可乐，小火收汁。"
    }
  },
  {
    name: "紫菜蛋花汤",
    category: "汤",
    price: 8,
    description: "简单快手的餐桌汤品",
    estimatedMinutes: 8,
    difficulty: "简单",
    isRecommended: false,
    recipe: {
      ingredients: "紫菜、鸡蛋 1 个",
      seasonings: "盐、香油、葱花",
      steps: "水开后加入紫菜；淋入蛋液；加盐调味，出锅前点香油和葱花。"
    }
  }
];

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

  const existing = db.prepare("SELECT COUNT(*) AS count FROM dishes").get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  const now = new Date().toISOString();
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

  for (const dish of seedDishes) {
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
