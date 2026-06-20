import { ClipboardList, History, Soup, Star, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const categoriesCount = useMemo(
    () => new Set(dishes.map((dish) => dish.category).filter(Boolean)).size,
    [dishes]
  );
  const recommendedCount = useMemo(() => dishes.filter((dish) => dish.isRecommended).length, [dishes]);
  const pendingOrdersCount = useMemo(() => orders.filter((order) => order.status === "pending").length, [orders]);

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
        <div className="brand-block">
          <p className="eyebrow">OrderFood 家庭厨房</p>
          <h1>今晚吃点什么</h1>
          <p className="header-copy">把家常菜、价格和做法放在一起，几分钟定下这顿饭。</p>
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

      <section className="summary-strip" aria-label="菜单概览">
        <div>
          <Soup size={20} aria-hidden="true" />
          <span>菜单</span>
          <strong>{dishes.length} 道菜可选</strong>
        </div>
        <div>
          <ClipboardList size={20} aria-hidden="true" />
          <span>分类</span>
          <strong>{categoriesCount} 个分类</strong>
        </div>
        <div>
          <Star size={20} aria-hidden="true" />
          <span>推荐</span>
          <strong>{recommendedCount} 道招牌菜</strong>
        </div>
        <div>
          <UsersRound size={20} aria-hidden="true" />
          <span>待做</span>
          <strong>{pendingOrdersCount} 笔订单</strong>
        </div>
      </section>

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
