import { commonDishes } from "../../server/src/db/commonDishes";
import { recipeVideos } from "../../server/src/db/recipeVideos";

export type ApiEnv = {
  DB: D1Database;
  UPLOADS: R2Bucket;
};

type Env = ApiEnv & {
  ASSETS: Fetcher;
};

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type ParsedRecipeStep = {
  stepOrder: number;
  instruction: string;
  imagePath: string;
};

type ParsedDishInput = {
  name: string;
  category: string;
  price: number;
  description: string;
  estimatedMinutes: number | null;
  difficulty: string;
  isRecommended: boolean;
  isFavorite: boolean;
  recipe: {
    ingredients: string;
    seasonings: string;
    steps: string;
    coverImagePath: string;
    videoUrl: string;
    stepItems: ParsedRecipeStep[];
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
};

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const schemaSql = `
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

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
`;

function json(body: JsonValue, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...init.headers
    }
  });
}

function empty(status = 204): Response {
  return new Response(null, { status, headers: corsHeaders });
}

function notFound(message = "资源不存在"): Response {
  return json({ message }, { status: 404 });
}

function badRequest(message: string): Response {
  return json({ message }, { status: 400 });
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
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

function buildRecipeVideoUrl(dishName: string): string {
  return recipeVideos[dishName]?.url ?? `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${dishName} 做法`)}`;
}

function assertHttpVideoUrl(value: unknown): string {
  const url = typeof value === "string" ? value.trim() : "";
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    throw Object.assign(new Error("视频链接必须以 http:// 或 https:// 开头"), { statusCode: 400 });
  }
  return url;
}

function parseDishInput(input: Record<string, any>): ParsedDishInput {
  const recipe = input.recipe && typeof input.recipe === "object" ? input.recipe : {};
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw Object.assign(new Error("菜名不能为空"), { statusCode: 400 });
  }
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    throw Object.assign(new Error("价格必须是非负数字"), { statusCode: 400 });
  }

  return {
    name,
    category: String(input.category ?? "").trim(),
    price,
    description: String(input.description ?? "").trim(),
    estimatedMinutes:
      input.estimatedMinutes === null || input.estimatedMinutes === undefined || input.estimatedMinutes === ""
        ? null
        : Math.max(0, Math.trunc(Number(input.estimatedMinutes))),
    difficulty: String(input.difficulty ?? "").trim(),
    isRecommended: Boolean(input.isRecommended),
    isFavorite: Boolean(input.isFavorite),
    recipe: {
      ingredients: String(recipe.ingredients ?? ""),
      seasonings: String(recipe.seasonings ?? ""),
      steps: String(recipe.steps ?? ""),
      coverImagePath: String(recipe.coverImagePath ?? ""),
      videoUrl: assertHttpVideoUrl(recipe.videoUrl),
      stepItems: Array.isArray(recipe.stepItems)
        ? recipe.stepItems.map((step: Record<string, any>, index: number) => ({
            stepOrder: index + 1,
            instruction: String(step.instruction ?? "").trim(),
            imagePath: String(step.imagePath ?? "").trim()
          }))
        : []
    }
  };
}

function normalizeRecipeSteps(input: ParsedDishInput): ParsedRecipeStep[] {
  const provided = input.recipe.stepItems.filter((step) => step.instruction || step.imagePath);
  if (provided.length > 0) {
    return provided.map((step, index) => ({ ...step, stepOrder: index + 1 }));
  }
  return splitRecipeSteps(input.recipe.steps).map((instruction, index) => ({ stepOrder: index + 1, instruction, imagePath: "" }));
}

async function ensureDatabase(db: D1Database): Promise<void> {
  await db.exec(schemaSql);
  const seeded = await db.prepare("SELECT value FROM app_metadata WHERE key = 'seeded_common_dishes_v2'").first<{ value: string }>();
  if (seeded?.value === "true") {
    return;
  }

  const now = new Date().toISOString();
  for (const dish of commonDishes) {
    const existing = await db.prepare("SELECT id FROM dishes WHERE name = ?").bind(dish.name).first<{ id: number }>();
    if (existing) {
      continue;
    }
    const result = await db
      .prepare(
        `INSERT INTO dishes (
          name, category, price, description, estimated_minutes, difficulty,
          is_recommended, is_favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        dish.name,
        dish.category,
        dish.price,
        dish.description,
        dish.estimatedMinutes,
        dish.difficulty,
        dish.isRecommended ? 1 : 0,
        now,
        now
      )
      .run();
    const dishId = result.meta.last_row_id;
    const recipeResult = await db
      .prepare(
        `INSERT INTO recipes (
          dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dishId,
        dish.recipe.ingredients,
        dish.recipe.seasonings,
        dish.recipe.steps,
        dish.recipe.coverImagePath,
        buildRecipeVideoUrl(dish.name),
        now,
        now
      )
      .run();
    for (const [index, instruction] of splitRecipeSteps(dish.recipe.steps).entries()) {
      await db
        .prepare(
          `INSERT INTO recipe_steps (recipe_id, step_order, instruction, image_path, created_at, updated_at)
           VALUES (?, ?, ?, '', ?, ?)`
        )
        .bind(recipeResult.meta.last_row_id, index + 1, instruction, now, now)
        .run();
    }
  }
  await db
    .prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seeded_common_dishes_v2', 'true')")
    .run();
}

async function getRecipeSteps(db: D1Database, dishId: number) {
  const { results } = await db
    .prepare(
      `SELECT rs.id, rs.step_order, rs.instruction, rs.image_path
       FROM recipe_steps rs
       INNER JOIN recipes r ON r.id = rs.recipe_id
       WHERE r.dish_id = ?
       ORDER BY rs.step_order ASC, rs.id ASC`
    )
    .bind(dishId)
    .all<any>();
  return results.map((row) => ({
    id: row.id,
    stepOrder: row.step_order,
    instruction: row.instruction,
    imagePath: row.image_path
  }));
}

async function mapDish(db: D1Database, row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    description: row.description,
    estimatedMinutes: row.estimated_minutes,
    difficulty: row.difficulty,
    isRecommended: row.is_recommended === 1,
    isFavorite: row.is_favorite === 1,
    recipe: {
      ingredients: row.ingredients ?? "",
      seasonings: row.seasonings ?? "",
      steps: row.steps ?? "",
      coverImagePath: row.cover_image_path ?? "",
      videoUrl: row.video_url ?? "",
      stepItems: await getRecipeSteps(db, row.id)
    }
  };
}

async function listDishes(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, d.is_favorite, r.ingredients, r.seasonings, r.steps,
        r.cover_image_path, r.video_url
       FROM dishes d
       LEFT JOIN recipes r ON r.dish_id = d.id
       ORDER BY d.is_recommended DESC, d.name ASC`
    )
    .all<any>();
  return json(await Promise.all(results.map((row) => mapDish(db, row))));
}

async function getDish(db: D1Database, id: number) {
  const row = await db
    .prepare(
      `SELECT d.id, d.name, d.category, d.price, d.description, d.estimated_minutes,
        d.difficulty, d.is_recommended, d.is_favorite, r.ingredients, r.seasonings, r.steps,
        r.cover_image_path, r.video_url
       FROM dishes d
       LEFT JOIN recipes r ON r.dish_id = d.id
       WHERE d.id = ?`
    )
    .bind(id)
    .first<any>();
  return row ? mapDish(db, row) : null;
}

async function replaceRecipeSteps(db: D1Database, dishId: number, input: ReturnType<typeof parseDishInput>, now: string) {
  const recipe = await db.prepare("SELECT id FROM recipes WHERE dish_id = ?").bind(dishId).first<{ id: number }>();
  if (!recipe) {
    return;
  }
  await db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").bind(recipe.id).run();
  for (const step of normalizeRecipeSteps(input)) {
    await db
      .prepare(
        `INSERT INTO recipe_steps (recipe_id, step_order, instruction, image_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(recipe.id, step.stepOrder, step.instruction, step.imagePath, now, now)
      .run();
  }
}

async function createDish(db: D1Database, request: Request): Promise<Response> {
  const input = parseDishInput((await request.json()) as Record<string, any>);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO dishes (
        name, category, price, description, estimated_minutes, difficulty,
        is_recommended, is_favorite, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.name,
      input.category,
      input.price,
      input.description,
      input.estimatedMinutes,
      input.difficulty,
      input.isRecommended ? 1 : 0,
      input.isFavorite ? 1 : 0,
      now,
      now
    )
    .run();
  const dishId = result.meta.last_row_id;
  await db
    .prepare(
      `INSERT INTO recipes (
        dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      dishId,
      input.recipe.ingredients,
      input.recipe.seasonings,
      input.recipe.steps,
      input.recipe.coverImagePath,
      input.recipe.videoUrl,
      now,
      now
    )
    .run();
  await replaceRecipeSteps(db, dishId, input, now);
  return json((await getDish(db, dishId)) as JsonValue, { status: 201 });
}

async function updateDish(db: D1Database, request: Request, id: number): Promise<Response> {
  const input = parseDishInput((await request.json()) as Record<string, any>);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE dishes
       SET name = ?, category = ?, price = ?, description = ?, estimated_minutes = ?,
         difficulty = ?, is_recommended = ?, is_favorite = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      input.name,
      input.category,
      input.price,
      input.description,
      input.estimatedMinutes,
      input.difficulty,
      input.isRecommended ? 1 : 0,
      input.isFavorite ? 1 : 0,
      now,
      id
    )
    .run();
  if (result.meta.changes === 0) {
    return notFound("菜品不存在");
  }
  await db
    .prepare(
      `INSERT INTO recipes (
        dish_id, ingredients, seasonings, steps, cover_image_path, video_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dish_id) DO UPDATE SET
        ingredients = excluded.ingredients,
        seasonings = excluded.seasonings,
        steps = excluded.steps,
        cover_image_path = excluded.cover_image_path,
        video_url = excluded.video_url,
        updated_at = excluded.updated_at`
    )
    .bind(
      id,
      input.recipe.ingredients,
      input.recipe.seasonings,
      input.recipe.steps,
      input.recipe.coverImagePath,
      input.recipe.videoUrl,
      now,
      now
    )
    .run();
  await replaceRecipeSteps(db, id, input, now);
  return json((await getDish(db, id)) as JsonValue);
}

async function updateDishFavorite(db: D1Database, request: Request, id: number): Promise<Response> {
  const input = (await request.json()) as { isFavorite?: boolean };
  const now = new Date().toISOString();
  const result = await db
    .prepare("UPDATE dishes SET is_favorite = ?, updated_at = ? WHERE id = ?")
    .bind(input.isFavorite ? 1 : 0, now, id)
    .run();
  if (result.meta.changes === 0) {
    return notFound("菜品不存在");
  }
  return json((await getDish(db, id)) as JsonValue);
}

async function deleteDish(db: D1Database, id: number): Promise<Response> {
  const result = await db.prepare("DELETE FROM dishes WHERE id = ?").bind(id).run();
  return result.meta.changes > 0 ? empty() : notFound("菜品不存在");
}

async function getOrderItems(db: D1Database, orderId: number) {
  const { results } = await db
    .prepare(
      `SELECT id, order_id, dish_id, dish_name, quantity, unit_price, subtotal
       FROM order_items WHERE order_id = ? ORDER BY id ASC`
    )
    .bind(orderId)
    .all<any>();
  return results.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    dishId: item.dish_id,
    dishName: item.dish_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal
  }));
}

async function mapOrder(db: D1Database, row: any) {
  return {
    id: row.id,
    orderedAt: row.ordered_at,
    dinersCount: row.diners_count,
    note: row.note,
    totalPrice: row.total_price,
    status: row.status,
    items: await getOrderItems(db, row.id)
  };
}

async function listOrders(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare("SELECT id, ordered_at, diners_count, note, total_price, status FROM orders ORDER BY ordered_at DESC, id DESC")
    .all<any>();
  return json(await Promise.all(results.map((row) => mapOrder(db, row))));
}

async function getOrder(db: D1Database, id: number) {
  const row = await db
    .prepare("SELECT id, ordered_at, diners_count, note, total_price, status FROM orders WHERE id = ?")
    .bind(id)
    .first<any>();
  return row ? mapOrder(db, row) : null;
}

function parseOrderInput(input: Record<string, any>) {
  const dinersCount = Math.trunc(Number(input.dinersCount));
  const items = Array.isArray(input.items) ? input.items : [];
  if (!Number.isFinite(dinersCount) || dinersCount < 1 || items.length === 0) {
    throw Object.assign(new Error("订单数据无效"), { statusCode: 400 });
  }
  return {
    dinersCount,
    note: String(input.note ?? ""),
    items: items.map((item: Record<string, any>) => ({
      dishId: Math.trunc(Number(item.dishId)),
      quantity: Math.trunc(Number(item.quantity))
    }))
  };
}

async function createOrder(db: D1Database, request: Request): Promise<Response> {
  const input = parseOrderInput((await request.json()) as Record<string, any>);
  const snapshots = [];
  for (const item of input.items) {
    if (item.quantity < 1) {
      throw Object.assign(new Error("菜品数量无效"), { statusCode: 400 });
    }
    const dish = await db.prepare("SELECT id, name, price FROM dishes WHERE id = ?").bind(item.dishId).first<any>();
    if (!dish) {
      throw Object.assign(new Error(`菜品不存在: ${item.dishId}`), { statusCode: 400 });
    }
    snapshots.push({
      ...item,
      dishName: dish.name,
      unitPrice: dish.price,
      subtotal: roundMoney(dish.price * item.quantity)
    });
  }
  const totalPrice = roundMoney(snapshots.reduce((total, item) => total + item.subtotal, 0));
  const now = new Date().toISOString();
  const result = await db
    .prepare("INSERT INTO orders (ordered_at, diners_count, note, total_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)")
    .bind(now, input.dinersCount, input.note, totalPrice, now, now)
    .run();
  const orderId = result.meta.last_row_id;
  for (const item of snapshots) {
    await db
      .prepare("INSERT INTO order_items (order_id, dish_id, dish_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(orderId, item.dishId, item.dishName, item.quantity, item.unitPrice, item.subtotal)
      .run();
  }
  return json((await getOrder(db, orderId)) as JsonValue, { status: 201 });
}

async function updateOrderStatus(db: D1Database, request: Request, id: number): Promise<Response> {
  const input = (await request.json()) as { status?: string };
  if (input.status !== "pending" && input.status !== "completed") {
    return badRequest("订单状态无效");
  }
  const result = await db
    .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
    .bind(input.status, new Date().toISOString(), id)
    .run();
  if (result.meta.changes === 0) {
    return notFound("订单不存在");
  }
  return json((await getOrder(db, id)) as JsonValue);
}

async function deleteOrder(db: D1Database, id: number): Promise<Response> {
  await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
  const result = await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
  return result.meta.changes > 0 ? empty() : notFound("订单不存在");
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
    ? date
    : null;
}

function dayBoundaryIso(value: string, boundary: "start" | "end"): string {
  const date = parseDateOnly(value);
  if (!date) {
    throw Object.assign(new Error("日期无效"), { statusCode: 400 });
  }
  date.setHours(boundary === "start" ? 0 : 23, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 999);
  return date.toISOString();
}

async function getOrderStats(db: D1Database, url: URL): Promise<Response> {
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || start.getTime() > end.getTime()) {
    return badRequest("消费统计日期范围无效");
  }
  const row = await db
    .prepare("SELECT COALESCE(SUM(total_price), 0) AS total, COUNT(*) AS order_count FROM orders WHERE ordered_at >= ? AND ordered_at <= ?")
    .bind(dayBoundaryIso(startDate, "start"), dayBoundaryIso(endDate, "end"))
    .first<any>();
  return json({
    total: roundMoney(row?.total ?? 0),
    orderCount: row?.order_count ?? 0,
    startDate,
    endDate
  });
}

async function uploadRecipeImage(env: ApiEnv, request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return badRequest("请选择要上传的图片");
  }
  const extension = allowedImageTypes.get(file.type);
  if (!extension) {
    return badRequest("仅支持 JPG、PNG 或 WebP 图片");
  }
  if (file.size > 5 * 1024 * 1024) {
    return badRequest("图片不能超过 5MB");
  }
  const key = `recipes/${Date.now()}-${crypto.randomUUID()}${extension}`;
  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });
  return json({ path: `/uploads/${key}` }, { status: 201 });
}

export async function serveUpload(env: ApiEnv, pathname: string): Promise<Response> {
  const key = pathname.replace(/^\/uploads\//, "");
  const object = await env.UPLOADS.get(key);
  if (!object) {
    return notFound("图片不存在");
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

export async function handleApi(env: ApiEnv, request: Request): Promise<Response> {
  await ensureDatabase(env.DB);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    return empty(204);
  }
  if (path === "/api/health" && method === "GET") {
    return json({ ok: true });
  }
  if (path === "/api/uploads/recipe-image" && method === "POST") {
    return uploadRecipeImage(env, request);
  }
  if (path === "/api/dishes" && method === "GET") {
    return listDishes(env.DB);
  }
  if (path === "/api/dishes" && method === "POST") {
    return createDish(env.DB, request);
  }
  const favoriteMatch = /^\/api\/dishes\/(\d+)\/favorite$/.exec(path);
  if (favoriteMatch && method === "PATCH") {
    return updateDishFavorite(env.DB, request, Number(favoriteMatch[1]));
  }
  const dishMatch = /^\/api\/dishes\/(\d+)$/.exec(path);
  if (dishMatch && method === "PUT") {
    return updateDish(env.DB, request, Number(dishMatch[1]));
  }
  if (dishMatch && method === "DELETE") {
    return deleteDish(env.DB, Number(dishMatch[1]));
  }
  if (path === "/api/orders" && method === "GET") {
    return listOrders(env.DB);
  }
  if (path === "/api/orders/stats" && method === "GET") {
    return getOrderStats(env.DB, url);
  }
  if (path === "/api/orders" && method === "POST") {
    return createOrder(env.DB, request);
  }
  const orderStatusMatch = /^\/api\/orders\/(\d+)\/status$/.exec(path);
  if (orderStatusMatch && method === "PATCH") {
    return updateOrderStatus(env.DB, request, Number(orderStatusMatch[1]));
  }
  const orderMatch = /^\/api\/orders\/(\d+)$/.exec(path);
  if (orderMatch && method === "DELETE") {
    return deleteOrder(env.DB, Number(orderMatch[1]));
  }
  return notFound("接口不存在");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(env, request);
      }
      if (url.pathname.startsWith("/uploads/")) {
        return await serveUpload(env, url.pathname);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number((error as any).statusCode) : 500;
      return json({ message: error instanceof Error ? error.message : "服务器错误" }, { status });
    }
  }
};
