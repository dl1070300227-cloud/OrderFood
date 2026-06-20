import { ClipboardList, History, Soup } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchDishes, fetchOrders } from "./api";
import { DishManager } from "./components/DishManager";
import { DishWorkspace } from "./components/DishWorkspace";
import { OrderHistory } from "./components/OrderHistory";
import type { Dish, Order } from "./types";

type Tab = "order" | "dishes" | "history";

const tabs: Array<{ id: Tab; label: string; icon: typeof Soup }> = [
  { id: "order", label: "点菜", icon: Soup },
  { id: "dishes", label: "菜品管理", icon: ClipboardList },
  { id: "history", label: "订单记录", icon: History }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("order");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDishes = useCallback(async () => {
    const nextDishes = await fetchDishes();
    setDishes(nextDishes);
  }, []);

  const loadOrders = useCallback(async () => {
    const nextOrders = await fetchOrders();
    setOrders(nextOrders);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      await Promise.all([loadDishes(), loadOrders()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [loadDishes, loadOrders]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">OrderFood</p>
          <h1>家用点菜小程序</h1>
        </div>
        <nav className="tab-nav" aria-label="主导航">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={activeTab === tab.id ? "active" : ""}
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {message ? <p className="global-message">{message}</p> : null}
      {isLoading ? <p className="loading-text">正在加载菜单...</p> : null}

      {!isLoading && activeTab === "order" ? (
        <DishWorkspace
          dishes={dishes}
          onOrderCreated={(order) => {
            setOrders((current) => [order, ...current]);
            setActiveTab("history");
          }}
        />
      ) : null}

      {!isLoading && activeTab === "dishes" ? <DishManager dishes={dishes} onChanged={loadDishes} /> : null}

      {!isLoading && activeTab === "history" ? (
        <OrderHistory orders={orders} onStatusChanged={loadOrders} />
      ) : null}
    </main>
  );
}
