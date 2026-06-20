import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

type DishSnapshotRow = {
  id: number;
  name: string;
  price: number;
};

type OrderRow = {
  id: number;
  ordered_at: string;
  diners_count: number;
  note: string;
  total_price: number;
  status: "pending" | "completed";
};

type OrderItemRow = {
  id: number;
  order_id: number;
  dish_id: number | null;
  dish_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Order = {
  id: number;
  orderedAt: string;
  dinersCount: number;
  note: string;
  totalPrice: number;
  status: "pending" | "completed";
  items: Array<{
    id: number;
    orderId: number;
    dishId: number | null;
    dishName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
};

export const createOrderSchema = z.object({
  dinersCount: z.number().int().min(1),
  note: z.string().default(""),
  items: z
    .array(
      z.object({
        dishId: z.number().int().positive(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1)
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "completed"])
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function mapOrder(row: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: row.id,
    orderedAt: row.ordered_at,
    dinersCount: row.diners_count,
    note: row.note,
    totalPrice: row.total_price,
    status: row.status,
    items: items.map((item) => ({
      id: item.id,
      orderId: item.order_id,
      dishId: item.dish_id,
      dishName: item.dish_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal
    }))
  };
}

export function listOrders(db: DatabaseSync): Order[] {
  const rows = db
    .prepare(
      `
      SELECT id, ordered_at, diners_count, note, total_price, status
      FROM orders
      ORDER BY ordered_at DESC, id DESC
    `
    )
    .all() as OrderRow[];

  return rows.map((row) => mapOrder(row, getOrderItems(db, row.id)));
}

export function getOrder(db: DatabaseSync, id: number): Order | null {
  const row = db
    .prepare("SELECT id, ordered_at, diners_count, note, total_price, status FROM orders WHERE id = ?")
    .get(id) as OrderRow | undefined;

  return row ? mapOrder(row, getOrderItems(db, id)) : null;
}

function getOrderItems(db: DatabaseSync, orderId: number): OrderItemRow[] {
  return db
    .prepare(
      `
      SELECT id, order_id, dish_id, dish_name, quantity, unit_price, subtotal
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `
    )
    .all(orderId) as OrderItemRow[];
}

export function createOrder(db: DatabaseSync, input: CreateOrderInput): Order {
  const dishStatement = db.prepare("SELECT id, name, price FROM dishes WHERE id = ?");
  const snapshots = input.items.map((item) => {
    const dish = dishStatement.get(item.dishId) as DishSnapshotRow | undefined;
    if (!dish) {
      throw Object.assign(new Error(`菜品不存在: ${item.dishId}`), { statusCode: 400 });
    }
    const subtotal = roundMoney(dish.price * item.quantity);
    return { ...item, dishName: dish.name, unitPrice: dish.price, subtotal };
  });

  const totalPrice = roundMoney(snapshots.reduce((total, item) => total + item.subtotal, 0));
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    const orderResult = db
      .prepare(
        `
        INSERT INTO orders (ordered_at, diners_count, note, total_price, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `
      )
      .run(now, input.dinersCount, input.note, totalPrice, now, now);

    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(
      `
      INSERT INTO order_items (order_id, dish_id, dish_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    );
    for (const item of snapshots) {
      insertItem.run(orderId, item.dishId, item.dishName, item.quantity, item.unitPrice, item.subtotal);
    }

    db.exec("COMMIT");
    const order = getOrder(db, orderId);
    if (!order) {
      throw new Error("创建订单失败");
    }
    return order;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateOrderStatus(
  db: DatabaseSync,
  id: number,
  status: "pending" | "completed"
): Order | null {
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
  if (result.changes === 0) {
    return null;
  }
  return getOrder(db, id);
}
