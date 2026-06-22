import { ArrowDown, ArrowUp, ExternalLink, ImageUp, Pencil, PlayCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createDish, deleteDish, getAssetUrl, updateDish, uploadRecipeImage } from "../api";
import type { Dish, DishInput } from "../types";
import { getVideoEmbed } from "../videoEmbed";

type DishManagerProps = {
  dishes: Dish[];
  onChanged: () => void;
};

function createEmptyStep(stepOrder = 1): DishInput["recipe"]["stepItems"][number] {
  return {
    stepOrder,
    instruction: "",
    imagePath: ""
  };
}

function createEmptyForm(): DishInput {
  return {
    name: "",
    category: "",
    price: 0,
    description: "",
    estimatedMinutes: null,
    difficulty: "",
    isRecommended: false,
    isFavorite: false,
    recipe: {
      ingredients: "",
      seasonings: "",
      steps: "",
      coverImagePath: "",
      videoUrl: "",
      stepItems: [createEmptyStep()]
    }
  };
}

export function DishManager({ dishes, onChanged }: DishManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DishInput>(() => createEmptyForm());
  const [message, setMessage] = useState("");
  const videoEmbed = getVideoEmbed(form.recipe.videoUrl);

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
      isFavorite: dish.isFavorite,
      recipe: {
        ...dish.recipe,
        stepItems: dish.recipe.stepItems.length > 0 ? dish.recipe.stepItems : [createEmptyStep()]
      }
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

  function updateRecipeStep(index: number, value: Partial<DishInput["recipe"]["stepItems"][number]>) {
    setForm((current) => ({
      ...current,
      recipe: {
        ...current.recipe,
        stepItems: current.recipe.stepItems.map((step, stepIndex) =>
          stepIndex === index ? { ...step, ...value } : step
        )
      }
    }));
  }

  function addRecipeStep() {
    setForm((current) => ({
      ...current,
      recipe: {
        ...current.recipe,
        stepItems: [...current.recipe.stepItems, createEmptyStep(current.recipe.stepItems.length + 1)]
      }
    }));
  }

  function removeRecipeStep(index: number) {
    setForm((current) => {
      const nextSteps = current.recipe.stepItems.filter((_step, stepIndex) => stepIndex !== index);
      return {
        ...current,
        recipe: {
          ...current.recipe,
          stepItems: (nextSteps.length > 0 ? nextSteps : [createEmptyStep()]).map((step, stepIndex) => ({
            ...step,
            stepOrder: stepIndex + 1
          }))
        }
      };
    });
  }

  function moveRecipeStep(index: number, direction: -1 | 1) {
    setForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.recipe.stepItems.length) {
        return current;
      }
      const nextSteps = [...current.recipe.stepItems];
      [nextSteps[index], nextSteps[targetIndex]] = [nextSteps[targetIndex], nextSteps[index]];
      return {
        ...current,
        recipe: {
          ...current.recipe,
          stepItems: nextSteps.map((step, stepIndex) => ({ ...step, stepOrder: stepIndex + 1 }))
        }
      };
    });
  }

  async function uploadImage(file: File, onUploaded: (path: string) => void) {
    setMessage("图片上传中...");
    try {
      const path = await uploadRecipeImage(file);
      onUploaded(path);
      setMessage("图片已上传");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片上传失败");
    }
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
      setForm(createEmptyForm());
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
        setForm(createEmptyForm());
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
          <span>文字步骤</span>
          <textarea value={form.recipe.steps} onChange={(event) => updateRecipe("steps", event.target.value)} />
        </label>

        <div className="recipe-editor">
          <div className="recipe-editor-heading">
            <div>
              <p className="eyebrow">图文和视频</p>
              <h3>制作教程</h3>
            </div>
            <button className="ghost-button" type="button" onClick={addRecipeStep}>
              <Plus size={16} aria-hidden="true" />
              添加步骤
            </button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>视频链接</span>
              <input
                placeholder="https://..."
                value={form.recipe.videoUrl}
                onChange={(event) => updateRecipe("videoUrl", event.target.value)}
              />
            </label>
            <label className="field upload-field">
              <span>菜品封面</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadImage(file, (path) => updateRecipe("coverImagePath", path));
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {videoEmbed ? (
            <div className="video-preview" aria-label="视频预览">
              <div className="section-heading">
                <h4>视频预览</h4>
                <span>{videoEmbed.kind === "link" ? "无法内嵌时可打开原链接" : "可直接播放"}</span>
              </div>
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
          ) : null}

          {form.recipe.coverImagePath ? (
            <div className="upload-preview">
              <img alt="菜品封面预览" src={getAssetUrl(form.recipe.coverImagePath)} />
              <button className="icon-text-button" type="button" onClick={() => updateRecipe("coverImagePath", "")}>
                <X size={15} aria-hidden="true" />
                移除封面
              </button>
            </div>
          ) : null}

          <div className="step-editor-list">
            {form.recipe.stepItems.map((step, index) => (
              <div className="step-editor-row" key={`${step.stepOrder}-${index}`}>
                <div className="step-editor-topline">
                  <strong>步骤 {index + 1}</strong>
                  <div className="icon-actions">
                    <button
                      type="button"
                      title="上移"
                      disabled={index === 0}
                      onClick={() => moveRecipeStep(index, -1)}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="下移"
                      disabled={index === form.recipe.stepItems.length - 1}
                      onClick={() => moveRecipeStep(index, 1)}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" title="删除步骤" onClick={() => removeRecipeStep(index)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <label className="field">
                  <span>步骤 {index + 1} 说明</span>
                  <textarea
                    value={step.instruction}
                    onChange={(event) => updateRecipeStep(index, { instruction: event.target.value })}
                  />
                </label>
                <label className="field upload-field">
                  <span>步骤 {index + 1} 图片</span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadImage(file, (path) => updateRecipeStep(index, { imagePath: path }));
                      }
                      event.target.value = "";
                    }}
                  />
                </label>
                {step.imagePath ? (
                  <div className="upload-preview">
                    <img alt={`步骤 ${index + 1} 图片预览`} src={getAssetUrl(step.imagePath)} />
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() => updateRecipeStep(index, { imagePath: "" })}
                    >
                      <ImageUp size={15} aria-hidden="true" />
                      更换图片
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

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
              setForm(createEmptyForm());
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
