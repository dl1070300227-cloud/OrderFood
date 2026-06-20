import { CheckCircle2, CircleDot } from "lucide-react";
import { updateOrderStatus } from "../api";
import type { Order } from "../types";

type OrderHistoryProps = {
  orders: Order[];
  onStatusChanged: () => void;
};

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function OrderHistory({ orders, onStatusChanged }: OrderHistoryProps) {
  async function toggleStatus(order: Order) {
    await updateOrderStatus(order.id, order.status === "pending" ? "completed" : "pending");
    onStatusChanged();
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">订单记录</p>
          <h2>最近点餐</h2>
        </div>
        <span className="dish-count">{orders.length} 笔</span>
      </div>

      <div className="order-list">
        {orders.length === 0 ? (
          <p className="empty-text">还没有订单记录</p>
        ) : (
          orders.map((order) => (
            <article className="order-row" key={order.id}>
              <div className="order-topline">
                <div>
                  <strong>{formatTime(order.orderedAt)}</strong>
                  <span>{order.dinersCount} 人用餐{order.note ? ` · ${order.note}` : ""}</span>
                </div>
                <span className={`status-pill ${order.status}`}>
                  {order.status === "completed" ? "已完成" : "待完成"}
                </span>
              </div>

              <div className="order-items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <span>{item.dishName} × {item.quantity}</span>
                    <span>{money(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="order-footer">
                <strong>合计 {money(order.totalPrice)}</strong>
                <button className="ghost-button" type="button" onClick={() => toggleStatus(order)}>
                  {order.status === "completed" ? (
                    <CircleDot size={17} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  )}
                  {order.status === "completed" ? "标记待完成" : "标记完成"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
