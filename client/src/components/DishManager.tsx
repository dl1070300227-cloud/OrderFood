import { Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { createDish, deleteDish, updateDish } from "../api";
import type { Dish, DishInput } from "../types";

type DishManagerProps = {
  dishes: Dish[];
  onChanged: () => void;
};

const emptyForm: DishInput = {
  name: "",
  category: "",
  price: 0,
  description: "",
  estimatedMinutes: null,
  difficulty: "",
  isRecommended: false,
  recipe: {
    ingredients: "",
    seasonings: "",
    steps: ""
  }
};

export function DishManager({ dishes, onChanged }: DishManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DishInput>(emptyForm);
  const [message, setMessage] = useState("");

  function editDish(dish: Dish) {
    setEditingId(dish.id);
    setForm({
      name: dish.name,
      category: dish.category,
      price: dish.price,
      description: dish.description,
      estimatedMinutes: dish.estimatedMinutes,
      difficulty: dish.difficulty,
      isRecommended: dish.isRecommended,
      recipe: dish.recipe
    });
    setMessage("");
  }

  function updateForm<K extends keyof DishInput>(key: K, value: DishInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRecipe<K extends keyof DishInput["recipe"]>(key: K, value: string) {
    setForm((current) => ({
      ...current,
      recipe: { ...current.recipe, [key]: value }
    }));
  }

  async function saveDish() {
    if (!form.name.trim()) {
      setMessage("菜名不能为空");
      return;
    }

    try {
      if (editingId) {
        await updateDish(editingId, form);
        setMessage("菜品已更新");
      } else {
        await createDish(form);
        setMessage("菜品已新增");
      }
      setEditingId(null);
      setForm(emptyForm);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function removeDish(dish: Dish) {
    if (!confirm("确定删除这道菜吗？")) {
      return;
    }

    try {
      await deleteDish(dish.id);
      setMessage("菜品已删除");
      if (editingId === dish.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <section className="manager-layout">
      <form className="panel edit-form" onSubmit={(event) => event.preventDefault()}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">菜品管理</p>
            <h2>{editingId ? "编辑菜品" : "新增菜品"}</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>菜名</span>
            <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
          </label>
          <label className="field">
            <span>分类</span>
            <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
          </label>
          <label className="field">
            <span>价格</span>
            <input
              min={0}
              step="0.01"
              type="number"
              value={form.price}
              onChange={(event) => updateForm("price", Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label className="field">
            <span>预计耗时</span>
            <input
              min={0}
              type="number"
              value={form.estimatedMinutes ?? ""}
              onChange={(event) =>
                updateForm("estimatedMinutes", event.target.value ? Math.max(0, Number(event.target.value)) : null)
              }
            />
          </label>
          <label className="field">
            <span>难度</span>
            <input value={form.difficulty} onChange={(event) => updateForm("difficulty", event.target.value)} />
          </label>
          <label className="field checkbox-field">
            <input
              checked={form.isRecommended}
              type="checkbox"
              onChange={(event) => updateForm("isRecommended", event.target.checked)}
            />
            <span>设为推荐</span>
          </label>
        </div>

        <label className="field">
          <span>简介</span>
          <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
        </label>
        <label className="field">
          <span>食材</span>
          <textarea value={form.recipe.ingredients} onChange={(event) => updateRecipe("ingredients", event.target.value)} />
        </label>
        <label className="field">
          <span>调料</span>
          <textarea value={form.recipe.seasonings} onChange={(event) => updateRecipe("seasonings", event.target.value)} />
        </label>
        <label className="field">
          <span>步骤</span>
          <textarea value={form.recipe.steps} onChange={(event) => updateRecipe("steps", event.target.value)} />
        </label>

        {message ? <p className="form-message">{message}</p> : null}

        <div className="actions-row">
          <button className="primary-button" type="button" onClick={saveDish}>
            <Save size={17} aria-hidden="true" />
            保存菜品
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
          >
            清空
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">已收录</p>
            <h2>{dishes.length} 道菜</h2>
          </div>
        </div>
        <div className="compact-list">
          {dishes.map((dish) => (
            <article className="compact-row" key={dish.id}>
              <div>
                <strong>{dish.name}</strong>
                <span>{dish.category || "未分类"} · ¥{dish.price.toFixed(2)}</span>
              </div>
              <div className="icon-actions">
                <button type="button" title="编辑" onClick={() => editDish(dish)}>
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button type="button" title="删除" onClick={() => removeDish(dish)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
