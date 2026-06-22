import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Minus,
  PlayCircle,
  Plus,
  Search,
  Send,
  Utensils,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createOrder, getAssetUrl, updateDishFavorite } from "../api";
import type { CartItem, Dish, Order, RecipeStep } from "../types";
import { getVideoEmbed } from "../videoEmbed";

type DishWorkspaceProps = {
  cart: CartItem[];
  dinersCountInput: string;
  dishes: Dish[];
  isMobileCartOpen: boolean;
  note: string;
  onDishChanged: (dish: Dish) => void;
  onOrderCreated: (order: Order) => void;
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  setDinersCountInput: Dispatch<SetStateAction<string>>;
  setIsMobileCartOpen: Dispatch<SetStateAction<boolean>>;
  setNote: Dispatch<SetStateAction<string>>;
};

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function normalizeDinersCount(value: string): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
}

function getDishImagePath(dish: Dish): string {
  return dish.recipe.coverImagePath || dish.recipe.stepItems.find((step) => step.imagePath)?.imagePath || getDishSearchImagePath(dish.name);
}

function getDishSearchImagePath(name: string): string {
  return `https://tse1.mm.bing.net/th?q=${encodeURIComponent(`${name} 菜品`)}&w=900&h=650&c=7&rs=1&p=0&o=5&pid=1.7`;
}

function getRecipeSteps(dish: Dish): RecipeStep[] {
  if (dish.recipe.stepItems.length > 0) {
    return dish.recipe.stepItems;
  }
  if (dish.recipe.steps.trim()) {
    return [{ stepOrder: 1, instruction: dish.recipe.steps, imagePath: "" }];
  }
  return [];
}

export function DishWorkspace({
  cart,
  dinersCountInput,
  dishes,
  isMobileCartOpen,
  note,
  onDishChanged,
  onOrderCreated,
  setCart,
  setDinersCountInput,
  setIsMobileCartOpen,
  setNote
}: DishWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(() => dishes.find((dish) => dish.category)?.category ?? "全部");
  const [selectedDishId, setSelectedDishId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dishCategories = useMemo(() => Array.from(new Set(dishes.map((dish) => dish.category).filter(Boolean))), [dishes]);
  const categories = dishCategories;

  useEffect(() => {
    if (dishCategories.length > 0 && !categories.includes(category)) {
      setCategory(dishCategories[0]);
    }
  }, [categories, category, dishCategories]);

  const selectedDish = useMemo(
    () => dishes.find((dish) => dish.id === selectedDishId) ?? null,
    [dishes, selectedDishId]
  );

  const visibleDishes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesCategory = dish.category === category;
      const matchesQuery =
        !keyword ||
        dish.name.toLowerCase().includes(keyword) ||
        dish.description.toLowerCase().includes(keyword);
      return matchesCategory && matchesQuery;
    });
  }, [category, dishes, query]);

  const totalPrice = cart.reduce((total, item) => total + item.dish.price * item.quantity, 0);
  const dinersCount = normalizeDinersCount(dinersCountInput);

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

  function changeDinersCount(delta: number) {
    setDinersCountInput((current) => String(Math.max(1, normalizeDinersCount(current) + delta)));
  }

  function updateDinersCount(value: string) {
    if (/^\d*$/.test(value)) {
      setDinersCountInput(value);
    }
  }

  function normalizeDinersInput() {
    setDinersCountInput((current) => String(normalizeDinersCount(current)));
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
        dinersCount: normalizeDinersCount(dinersCountInput),
        note,
        items: cart.map((item) => ({ dishId: item.dish.id, quantity: item.quantity }))
      });
      setCart([]);
      setNote("");
      setDinersCountInput("1");
      setIsMobileCartOpen(false);
      setMessage("订单已生成");
      onOrderCreated(order);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleFavorite(dish: Dish) {
    setMessage("");
    try {
      const nextDish = await updateDishFavorite(dish.id, !dish.isFavorite);
      onDishChanged(nextDish);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "喜爱状态保存失败");
    }
  }

  function countByCategory(item: string): number {
    return dishes.filter((dish) => dish.category === item).length;
  }

  function renderDishImage(dish: Dish, className: string, alt: string) {
    const imagePath = getDishImagePath(dish);
    if (!imagePath) {
      return (
        <div className={`${className} image-placeholder`} aria-label={alt} role="img">
          <ImageIcon size={24} aria-hidden="true" />
        </div>
      );
    }
    return <img alt={alt} className={className} src={getAssetUrl(imagePath)} />;
  }

  function renderCartPanel(className = "panel cart-panel") {
    return (
      <aside className={className} aria-label="本次餐单">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">已选菜品</p>
            <h2>本次餐单</h2>
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
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            value={dinersCountInput}
            onBlur={normalizeDinersInput}
            onChange={(event) => updateDinersCount(event.target.value)}
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
    );
  }

  function renderMobileCartDrawer() {
    return (
      <>
        <button
          aria-label="关闭已选菜品"
          className="mobile-cart-backdrop"
          type="button"
          onClick={() => setIsMobileCartOpen(false)}
        />
        <div className="mobile-cart-drawer" role="dialog" aria-label="已选菜品">
          <div className="mobile-cart-drawer-heading">
            <div>
              <p className="eyebrow">已选菜品</p>
              <h2>本次餐单</h2>
            </div>
            <button
              aria-label="关闭已选菜品"
              className="favorite-button"
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="meal-ticket">
            <span>已选 {cart.length} 道</span>
            <span>{money(totalPrice)}</span>
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
            <div className="diners-control">
              <button type="button" aria-label="减少就餐人数" onClick={() => changeDinersCount(-1)}>
                <Minus size={15} aria-hidden="true" />
              </button>
              <input
                aria-label="移动端就餐人数"
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={dinersCountInput}
                onBlur={normalizeDinersInput}
                onChange={(event) => updateDinersCount(event.target.value)}
              />
              <button type="button" aria-label="增加就餐人数" onClick={() => changeDinersCount(1)}>
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              aria-label="移动端备注"
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
        </div>
      </>
    );
  }

  function renderMobileCartBar() {
    return (
      <section className="mobile-cart-bar" aria-label="移动端已选菜品">
        <div>
          <span>已选 {cart.length} 道</span>
          <strong>{money(totalPrice)}</strong>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={cart.length === 0}
          onClick={() => setIsMobileCartOpen(true)}
        >
          <Utensils size={17} aria-hidden="true" />
          查看已选菜品
        </button>
      </section>
    );
  }

  if (selectedDish) {
    const selectedQuantity = cart.find((item) => item.dish.id === selectedDish.id)?.quantity ?? 0;
    const recipeSteps = getRecipeSteps(selectedDish);
    const videoEmbed = getVideoEmbed(selectedDish.recipe.videoUrl);

    return (
      <section className="workspace-grid" aria-label="点菜工作台">
        <article className="dish-detail-page" aria-label={`${selectedDish.name}详情`}>
          <button className="detail-back-button" type="button" onClick={() => setSelectedDishId(null)}>
            <ArrowLeft size={18} aria-hidden="true" />
            返回菜品列表
          </button>

          <div className="detail-hero">
            {renderDishImage(selectedDish, "detail-hero-image", `${selectedDish.name}菜品图`)}
            <div className="detail-hero-content">
              <div>
                <div className="dish-title-row">
                  <h2>{selectedDish.name}</h2>
                  <button
                    aria-label={`${selectedDish.isFavorite ? "取消喜爱" : "喜爱"} ${selectedDish.name}`}
                    aria-pressed={selectedDish.isFavorite}
                    className={`favorite-button ${selectedDish.isFavorite ? "active" : ""}`}
                    type="button"
                    onClick={() => void toggleFavorite(selectedDish)}
                  >
                    <Heart size={17} aria-hidden="true" fill={selectedDish.isFavorite ? "currentColor" : "none"} />
                  </button>
                </div>
                <p>{selectedDish.description || "暂无简介"}</p>
              </div>
              <div className="meta-row">
                <span><Utensils size={14} aria-hidden="true" />{selectedDish.category || "未分类"}</span>
                <span><Clock3 size={14} aria-hidden="true" />{selectedDish.estimatedMinutes ?? "-"} 分钟</span>
                <span>{selectedDish.difficulty || "未标注"}</span>
              </div>
              <div className="detail-action-row">
                <strong>{money(selectedDish.price)}</strong>
                {selectedQuantity > 0 ? (
                  <span className="selected-badge" aria-live="polite">已选 {selectedQuantity} 份</span>
                ) : null}
                <button
                  aria-label={`加入餐单 ${selectedDish.name}`}
                  className="primary-button add-cart-button"
                  type="button"
                  onClick={() => addDish(selectedDish)}
                >
                  <Plus size={17} aria-hidden="true" />
                  加入餐单
                </button>
              </div>
            </div>
          </div>

          <section className="recipe-section" aria-label="图文教程">
            <div className="section-heading">
              <h3>图文教程</h3>
              <span>先看食材和步骤</span>
            </div>
            <div className="recipe-meta-grid">
              <p><strong>食材</strong>{selectedDish.recipe.ingredients || "暂无"}</p>
              <p><strong>调料</strong>{selectedDish.recipe.seasonings || "暂无"}</p>
            </div>
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
                    ) : (
                      <div className="recipe-step-image image-placeholder" aria-label={`步骤 ${index + 1}`} role="img">
                        <ImageIcon size={22} aria-hidden="true" />
                      </div>
                    )}
                    <div>
                      <span>步骤 {index + 1}</span>
                      <p>{step.instruction || "暂无步骤说明"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-text">暂无图文教程</p>
              )}
            </div>
          </section>

          <section className="recipe-section video-section" aria-label="视频教程">
            <div className="section-heading">
              <h3>视频教程</h3>
              <span>照着做更稳</span>
            </div>
            {videoEmbed ? (
              <div className="embedded-video-card">
                {videoEmbed.kind === "iframe" ? (
                  <iframe
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="embedded-video-player"
                    loading="lazy"
                    src={videoEmbed.src}
                    title={videoEmbed.title}
                  />
                ) : videoEmbed.kind === "video" ? (
                  <video className="embedded-video-player" controls preload="metadata" src={videoEmbed.src}>
                    当前浏览器不支持直接播放该视频。
                  </video>
                ) : (
                  <div className="video-unsupported">
                    <PlayCircle size={22} aria-hidden="true" />
                    <p>这个链接暂不支持内嵌播放</p>
                  </div>
                )}
                <a className="video-link" href={videoEmbed.originalUrl} rel="noreferrer" target="_blank">
                  <ExternalLink size={15} aria-hidden="true" />
                  打开原视频
                </a>
              </div>
            ) : (
              <p className="empty-text">暂无视频教程</p>
            )}
          </section>
        </article>

        {renderCartPanel()}
        {renderMobileCartBar()}
        {isMobileCartOpen ? renderMobileCartDrawer() : null}
      </section>
    );
  }

  return (
    <section className="workspace-grid" aria-label="点菜工作台">
      <div className="takeout-shell">
        <nav className="category-rail" aria-label="菜品分类">
          {categories.map((item) => (
            <button
              aria-pressed={category === item}
              className={category === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              <span>{item}</span>
              <strong>{countByCategory(item)}</strong>
            </button>
          ))}
        </nav>

        <section className="takeout-menu" aria-label={`${category}菜品`}>
          <div className="takeout-menu-heading">
            <div>
              <p className="eyebrow">点菜</p>
              <h2>{category}</h2>
            </div>
            <label className="search-pill">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">搜索菜品</span>
              <input
                aria-label="搜索菜品"
                placeholder="搜索菜名"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="takeout-menu-list">
          {visibleDishes.map((dish) => {
            const selectedQuantity = cart.find((item) => item.dish.id === dish.id)?.quantity ?? 0;
            return (
              <article className="takeout-dish-card" key={dish.id}>
                <button
                  aria-label={`查看菜品 ${dish.name}`}
                  className="takeout-dish-open"
                  type="button"
                  onClick={() => setSelectedDishId(dish.id)}
                >
                  {renderDishImage(dish, "takeout-dish-image", `${dish.name}菜品图`)}
                  <span className="takeout-dish-copy">
                    <span className="dish-card-title">{dish.name}</span>
                    <span className="dish-card-description">{dish.description || "暂无简介"}</span>
                    <span className="meta-row">
                      <span><Clock3 size={14} aria-hidden="true" />{dish.estimatedMinutes ?? "-"} 分钟</span>
                      <span>{dish.difficulty || "未标注"}</span>
                    </span>
                  </span>
                </button>
                <div className="takeout-card-actions">
                  <div>
                    <strong>{money(dish.price)}</strong>
                    {selectedQuantity > 0 ? (
                      <span className="selected-badge" aria-live="polite">已选 {selectedQuantity} 份</span>
                    ) : null}
                  </div>
                  {dish.isRecommended ? <span className="tag">推荐</span> : null}
                  <button
                    aria-label={`${dish.isFavorite ? "取消喜爱" : "喜爱"} ${dish.name}`}
                    aria-pressed={dish.isFavorite}
                    className={`favorite-button ${dish.isFavorite ? "active" : ""}`}
                    type="button"
                    onClick={() => void toggleFavorite(dish)}
                  >
                    <Heart size={17} aria-hidden="true" fill={dish.isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button
                    aria-label={`加入餐单 ${dish.name}`}
                    className="round-add-button"
                    type="button"
                    onClick={() => addDish(dish)}
                  >
                    <Plus size={17} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
          {visibleDishes.length === 0 ? <p className="empty-text">这个分类暂时没有菜品</p> : null}
          </div>
        </section>
      </div>

      {renderCartPanel()}
      {renderMobileCartBar()}
      {isMobileCartOpen ? renderMobileCartDrawer() : null}
    </section>
  );
}
