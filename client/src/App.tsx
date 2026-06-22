import { ClipboardList, History, Soup } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchDishes, fetchOrders, fetchOrderStats } from "./api";
import { DishManager } from "./components/DishManager";
import { DishWorkspace } from "./components/DishWorkspace";
import { OrderHistory } from "./components/OrderHistory";
import type { CartItem, Dish, Order, OrderStats, OrderStatsRange } from "./types";

type Tab = "order" | "dishes" | "history";

const tabs: Array<{ id: Tab; label: string; icon: typeof Soup }> = [
  { id: "order", label: "点菜", icon: Soup },
  { id: "dishes", label: "菜品管理", icon: ClipboardList },
  { id: "history", label: "订单记录", icon: History }
];

type OrderStatsState = {
  today: OrderStats | null;
  month: OrderStats | null;
  year: OrderStats | null;
  custom: OrderStats | null;
};

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultStatsRanges(now = new Date()): {
  today: OrderStatsRange;
  month: OrderStatsRange;
  year: OrderStatsRange;
  custom: OrderStatsRange;
} {
  const today = formatDateOnly(now);
  return {
    today: { startDate: today, endDate: today },
    month: { startDate: formatDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today },
    year: { startDate: formatDateOnly(new Date(now.getFullYear(), 0, 1)), endDate: today },
    custom: { startDate: formatDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today }
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("order");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dinersCountInput, setDinersCountInput] = useState("1");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [statsRanges, setStatsRanges] = useState(() => getDefaultStatsRanges());
  const [orderStats, setOrderStats] = useState<OrderStatsState>({
    today: null,
    month: null,
    year: null,
    custom: null
  });
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

  const loadOrderStats = useCallback(async (customRange = statsRanges.custom) => {
    const [today, month, year, custom] = await Promise.all([
      fetchOrderStats(statsRanges.today),
      fetchOrderStats(statsRanges.month),
      fetchOrderStats(statsRanges.year),
      fetchOrderStats(customRange)
    ]);
    setOrderStats({ today, month, year, custom });
  }, [statsRanges]);

  const loadOrdersAndStats = useCallback(async () => {
    await Promise.all([loadOrders(), loadOrderStats()]);
  }, [loadOrders, loadOrderStats]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      await Promise.all([loadDishes(), loadOrdersAndStats()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [loadDishes, loadOrdersAndStats]);

  const updateCustomStatsRange = useCallback(async (range: OrderStatsRange) => {
    setStatsRanges((current) => ({ ...current, custom: range }));
    const custom = await fetchOrderStats(range);
    setOrderStats((current) => ({ ...current, custom }));
  }, []);

  const updateDishInList = useCallback((nextDish: Dish) => {
    setDishes((current) => current.map((dish) => (dish.id === nextDish.id ? nextDish : dish)));
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <main className="app-shell">
      <header className="app-header">
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
          cart={cart}
          dinersCountInput={dinersCountInput}
          dishes={dishes}
          isMobileCartOpen={isMobileCartOpen}
          note={note}
          onDishChanged={updateDishInList}
          onOrderCreated={(order) => {
            setOrders((current) => [order, ...current]);
            setActiveTab("history");
            void loadOrderStats();
          }}
          setCart={setCart}
          setDinersCountInput={setDinersCountInput}
          setIsMobileCartOpen={setIsMobileCartOpen}
          setNote={setNote}
        />
      ) : null}

      {!isLoading && activeTab === "dishes" ? <DishManager dishes={dishes} onChanged={loadDishes} /> : null}

      {!isLoading && activeTab === "history" ? (
        <OrderHistory
          customRange={statsRanges.custom}
          orders={orders}
          stats={orderStats}
          onCustomRangeChanged={updateCustomStatsRange}
          onOrderDeleted={loadOrdersAndStats}
          onStatusChanged={loadOrdersAndStats}
        />
      ) : null}
    </main>
  );
}
