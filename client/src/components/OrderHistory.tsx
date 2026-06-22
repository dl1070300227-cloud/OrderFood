import { CheckCircle2, CircleDot, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteOrder, updateOrderStatus } from "../api";
import type { Order, OrderStats, OrderStatsRange } from "../types";

type OrderHistoryProps = {
  customRange: OrderStatsRange;
  orders: Order[];
  stats: {
    today: OrderStats | null;
    month: OrderStats | null;
    year: OrderStats | null;
    custom: OrderStats | null;
  };
  onCustomRangeChanged: (range: OrderStatsRange) => Promise<void>;
  onOrderDeleted: () => void;
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

function StatCard({ label, stats }: { label: string; stats: OrderStats | null }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{money(stats?.total ?? 0)}</strong>
      <small>{stats?.orderCount ?? 0} 笔订单</small>
    </div>
  );
}

export function OrderHistory({
  customRange,
  orders,
  stats,
  onCustomRangeChanged,
  onOrderDeleted,
  onStatusChanged
}: OrderHistoryProps) {
  const [range, setRange] = useState(customRange);
  const [rangeMessage, setRangeMessage] = useState("");

  async function toggleStatus(order: Order) {
    await updateOrderStatus(order.id, order.status === "pending" ? "completed" : "pending");
    onStatusChanged();
  }

  async function handleDelete(order: Order) {
    if (!window.confirm(`确定删除这笔 ${money(order.totalPrice)} 的订单吗？`)) {
      return;
    }

    await deleteOrder(order.id);
    onOrderDeleted();
  }

  async function submitCustomRange() {
    if (range.startDate > range.endDate) {
      setRangeMessage("开始日期不能晚于结束日期");
      return;
    }

    setRangeMessage("");
    await onCustomRangeChanged(range);
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

      <div className="stats-grid" aria-label="消费统计">
        <StatCard label="今日消费" stats={stats.today} />
        <StatCard label="本月消费" stats={stats.month} />
        <StatCard label="年度消费" stats={stats.year} />
        <StatCard label="自定义消费" stats={stats.custom} />
      </div>

      <div className="custom-stats-bar">
        <label className="field">
          <span>开始日期</span>
          <input
            type="date"
            value={range.startDate}
            onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>结束日期</span>
          <input
            type="date"
            value={range.endDate}
            onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
          />
        </label>
        <button className="ghost-button" type="button" onClick={() => void submitCustomRange()}>
          <Search size={17} aria-hidden="true" />
          查询消费
        </button>
      </div>
      {rangeMessage ? <p className="form-message">{rangeMessage}</p> : null}

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
                <div className="order-actions">
                  <button className="ghost-button" type="button" onClick={() => void toggleStatus(order)}>
                    {order.status === "completed" ? (
                      <CircleDot size={17} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={17} aria-hidden="true" />
                    )}
                    {order.status === "completed" ? "标记待完成" : "标记完成"}
                  </button>
                  <button className="danger-button" type="button" onClick={() => void handleDelete(order)}>
                    <Trash2 size={17} aria-hidden="true" />
                    删除订单
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
