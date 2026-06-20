import { BookOpen, Clock3, ExternalLink, Minus, Plus, Search, Send, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { createOrder, getAssetUrl } from "../api";
import type { CartItem, Dish, Order } from "../types";

type DishWorkspaceProps = {
  dishes: Dish[];
  onOrderCreated: (order: Order) => void;
};

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

export function DishWorkspace({ dishes, onOrderCreated }: DishWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [expandedDishId, setExpandedDishId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dinersCount, setDinersCount] = useState(1);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(dishes.map((dish) => dish.category).filter(Boolean)))],
    [dishes]
  );

  const visibleDishes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesCategory = category === "全部" || dish.category === category;
      const matchesQuery =
        !keyword ||
        dish.name.toLowerCase().includes(keyword) ||
        dish.description.toLowerCase().includes(keyword);
      return matchesCategory && matchesQuery;
    });
  }, [category, dishes, query]);

  const totalPrice = cart.reduce((total, item) => total + item.dish.price * item.quantity, 0);

  function addDish(dish: Dish) {
    setMessage("");
    setCart((current) => {
      const existing = current.find((item) => item.dish.id === dish.id);
      if (existing) {
        return current.map((item) =>
          item.dish.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { dish, quantity: 1 }];
    });
  }

  function changeQuantity(dishId: number, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.dish.id === dishId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function submitOrder() {
    if (cart.length === 0) {
      setMessage("请先加入至少一道菜");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      const order = await createOrder({
        dinersCount,
        note,
        items: cart.map((item) => ({ dishId: item.dish.id, quantity: item.quantity }))
      });
      setCart([]);
      setNote("");
      setDinersCount(1);
      setMessage("订单已生成");
      onOrderCreated(order);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="workspace-grid" aria-label="点菜工作台">
      <div className="panel dish-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">点菜工作台</p>
            <h2>从菜单里挑几道</h2>
          </div>
          <span className="dish-count">{visibleDishes.length} 道菜</span>
        </div>

        <div className="toolbar">
          <label className="field search-field">
            <span>搜索菜品</span>
            <div className="input-with-icon">
              <Search size={18} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </label>
          <label className="field">
            <span>分类</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="dish-list">
          {visibleDishes.map((dish) => {
            const isExpanded = expandedDishId === dish.id;
            const recipeSteps =
              dish.recipe.stepItems.length > 0
                ? dish.recipe.stepItems
                : dish.recipe.steps.trim()
                  ? [{ stepOrder: 1, instruction: dish.recipe.steps, imagePath: "" }]
                  : [];
            return (
              <article className="dish-item" key={dish.id}>
                <div className="dish-main">
                  <div>
                    <div className="dish-title-row">
                      <h3>{dish.name}</h3>
                      {dish.isRecommended ? <span className="tag">推荐</span> : null}
                    </div>
                    <p>{dish.description || "暂无简介"}</p>
                    <div className="meta-row">
                      <span><Utensils size={14} aria-hidden="true" />{dish.category || "未分类"}</span>
                      <span><Clock3 size={14} aria-hidden="true" />{dish.estimatedMinutes ?? "-"} 分钟</span>
                      <span>{dish.difficulty || "未标注"}</span>
                    </div>
                  </div>
                  <strong>{money(dish.price)}</strong>
                </div>

                <div className="actions-row">
                  <button className="ghost-button" type="button" onClick={() => setExpandedDishId(isExpanded ? null : dish.id)}>
                    <BookOpen size={17} aria-hidden="true" />
                    教程
                  </button>
                  <button className="primary-button" type="button" onClick={() => addDish(dish)}>
                    <Plus size={17} aria-hidden="true" />
                    加入餐单
                  </button>
                </div>

                {isExpanded ? (
                  <div className="recipe-box">
                    {dish.recipe.coverImagePath ? (
                      <img
                        alt={`${dish.name} 封面`}
                        className="recipe-cover"
                        src={getAssetUrl(dish.recipe.coverImagePath)}
                      />
                    ) : null}
                    <div className="recipe-meta-grid">
                      <p><strong>食材：</strong>{dish.recipe.ingredients || "暂无"}</p>
                      <p><strong>调料：</strong>{dish.recipe.seasonings || "暂无"}</p>
                    </div>
                    {dish.recipe.videoUrl ? (
                      <a
                        className="video-link"
                        href={dish.recipe.videoUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                        打开视频教程
                      </a>
                    ) : null}
                    <div className="recipe-steps">
                      {recipeSteps.length > 0 ? (
                        recipeSteps.map((step, index) => (
                          <div className="recipe-step" key={`${step.stepOrder}-${index}`}>
                            {step.imagePath ? (
                              <img
                                alt={`步骤 ${index + 1}`}
                                className="recipe-step-image"
                                src={getAssetUrl(step.imagePath)}
                              />
                            ) : null}
                            <div>
                              <span>步骤 {index + 1}</span>
                              <p>{step.instruction || "暂无步骤说明"}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="empty-text">暂无教程</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <aside className="panel cart-panel" aria-label="本次餐单">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">家庭餐单</p>
            <h2>这顿准备做</h2>
          </div>
          <strong>{money(totalPrice)}</strong>
        </div>

        <div className="meal-ticket">
          <span>已选 {cart.length} 道</span>
          <span>{dinersCount} 人用餐</span>
        </div>

        <div className="cart-list">
          {cart.length === 0 ? (
            <p className="empty-text">还没有加入菜品</p>
          ) : (
            cart.map((item) => (
              <div className="cart-row" key={item.dish.id}>
                <div>
                  <strong>{item.dish.name}</strong>
                  <span>{money(item.dish.price)} / 份</span>
                </div>
                <div className="stepper">
                  <button type="button" aria-label={`减少 ${item.dish.name}`} onClick={() => changeQuantity(item.dish.id, -1)}>
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" aria-label={`增加 ${item.dish.name}`} onClick={() => changeQuantity(item.dish.id, 1)}>
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <label className="field">
          <span>就餐人数</span>
          <input
            aria-label="就餐人数"
            min={1}
            type="number"
            value={dinersCount}
            onChange={(event) => setDinersCount(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>

        <label className="field">
          <span>备注</span>
          <textarea
            aria-label="备注"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：少油、不要辣"
          />
        </label>

        {message ? <p className="form-message">{message}</p> : null}

        <button className="submit-button" type="button" disabled={isSubmitting} onClick={submitOrder}>
          <Send size={18} aria-hidden="true" />
          {isSubmitting ? "提交中" : "提交订单"}
        </button>
      </aside>
    </section>
  );
}
