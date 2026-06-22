import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const dishes = [
  {
    id: 1,
    name: "番茄炒蛋",
    category: "家常菜",
    price: 18,
    description: "酸甜下饭",
    estimatedMinutes: 12,
    difficulty: "简单",
    isRecommended: true,
    isFavorite: false,
    recipe: {
      ingredients: "番茄，鸡蛋",
      seasonings: "盐，糖",
      steps: "合炒调味",
      coverImagePath: "/uploads/recipes/cover.png",
      videoUrl: "https://www.bilibili.com/video/BV1Xt411Z7z8",
      stepItems: [
        {
          stepOrder: 1,
          instruction: "切好番茄",
          imagePath: "/uploads/recipes/step-1.png"
        },
        {
          stepOrder: 2,
          instruction: "合炒调味",
          imagePath: ""
        }
      ]
    }
  },
  {
    id: 2,
    name: "红烧茄子",
    category: "家常菜",
    price: 16,
    description: "软糯入味",
    estimatedMinutes: 18,
    difficulty: "简单",
    isRecommended: false,
    isFavorite: true,
    recipe: {
      ingredients: "茄子",
      seasonings: "生抽，蒜",
      steps: "煎软后调味",
      coverImagePath: "",
      videoUrl: "",
      stepItems: []
    }
  }
];

const orderRecord = {
  id: 1,
  orderedAt: new Date().toISOString(),
  dinersCount: 2,
  note: "少油",
  totalPrice: 18,
  status: "pending",
  items: [
    {
      id: 1,
      orderId: 1,
      dishId: 1,
      dishName: "番茄炒蛋",
      quantity: 1,
      unitPrice: 18,
      subtotal: 18
    }
  ]
};

let uploadCount = 0;
let savedDishPayload: unknown;
let mockDishes: typeof dishes;
let mockOrders: typeof orderRecord[];

beforeEach(() => {
  uploadCount = 0;
  savedDishPayload = undefined;
  mockDishes = dishes.map((dish) => ({ ...dish, recipe: { ...dish.recipe, stepItems: [...dish.recipe.stepItems] } }));
  mockOrders = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/dishes") && (!init || init.method === undefined)) {
        return Response.json(mockDishes);
      }
      if (url.includes("/api/orders/stats") && (!init || init.method === undefined)) {
        return Response.json({
          total: 128.5,
          orderCount: 3,
          startDate: "2026-06-01",
          endDate: "2026-06-21"
        });
      }
      if (url.endsWith("/api/orders") && (!init || init.method === undefined)) {
        return Response.json(mockOrders);
      }
      if (url.endsWith("/api/orders") && init?.method === "POST") {
        return Response.json(
          {
            id: 1,
            orderedAt: new Date().toISOString(),
            dinersCount: 2,
            note: "少油",
            totalPrice: 18,
            status: "pending",
            items: []
          },
          { status: 201 }
        );
      }
      if (url.endsWith("/api/orders/1") && init?.method === "DELETE") {
        mockOrders = mockOrders.filter((order) => order.id !== 1);
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/api/dishes/1/favorite") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { isFavorite: boolean };
        mockDishes = mockDishes.map((dish) => (dish.id === 1 ? { ...dish, isFavorite: body.isFavorite } : dish));
        return Response.json(mockDishes.find((dish) => dish.id === 1));
      }
      if (url.endsWith("/api/uploads/recipe-image") && init?.method === "POST") {
        uploadCount += 1;
        return Response.json(
          { path: uploadCount === 1 ? "/uploads/recipes/new-cover.png" : "/uploads/recipes/new-step.png" },
          { status: 201 }
        );
      }
      if (url.endsWith("/api/dishes") && init?.method === "POST") {
        savedDishPayload = JSON.parse(String(init.body));
        return Response.json({ id: 2, ...(savedDishPayload as object) }, { status: 201 });
      }
      return Response.json({}, { status: 404 });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("orders a dish from the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "加入餐单 番茄炒蛋" }));
    expect(await screen.findByText("已选 1 份")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("就餐人数"));
    await user.type(screen.getByLabelText("就餐人数"), "2");
    await user.type(screen.getByLabelText("备注"), "少油");
    await user.click(screen.getByRole("button", { name: "提交订单" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("shows the redesigned kitchen summary", async () => {
    render(<App />);

    expect(await screen.findByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "点菜" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "菜品管理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "订单记录" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "菜单概览" })).not.toBeInTheDocument();
  });

  it("shows a takeout-style category rail and opens a dish detail page", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("navigation", { name: "菜品分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "家常菜 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全部 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "爱好 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "招牌 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "家常菜菜品" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看菜品 番茄炒蛋" }));

    const detail = await screen.findByRole("article", { name: "番茄炒蛋详情" });
    expect(within(detail).getByRole("img", { name: "番茄炒蛋菜品图" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/cover.png"
    );
    expect(within(detail).getByRole("button", { name: "加入餐单 番茄炒蛋" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "返回菜品列表" })).toBeInTheDocument();
  });

  it("uses a real dish image instead of a placeholder when the recipe cover is empty", async () => {
    render(<App />);

    const eggplantImage = await screen.findByRole("img", { name: "红烧茄子菜品图" });

    expect(eggplantImage).toHaveAttribute(
      "src",
      "https://tse1.mm.bing.net/th?q=%E7%BA%A2%E7%83%A7%E8%8C%84%E5%AD%90%20%E8%8F%9C%E5%93%81&w=900&h=650&c=7&rs=1&p=0&o=5&pid=1.7"
    );
  });

  it("shows dish detail recipe images before the video tutorial", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "查看菜品 番茄炒蛋" }));

    const detail = await screen.findByRole("article", { name: "番茄炒蛋详情" });
    const graphicRecipe = within(detail).getByRole("region", { name: "图文教程" });
    const videoRecipe = within(detail).getByRole("region", { name: "视频教程" });

    expect(within(graphicRecipe).getByText("食材")).toBeInTheDocument();
    expect(within(graphicRecipe).getByText("番茄，鸡蛋")).toBeInTheDocument();
    expect(within(graphicRecipe).getByText("切好番茄")).toBeInTheDocument();
    expect(within(graphicRecipe).getByRole("img", { name: "步骤 1" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/step-1.png"
    );
    expect(within(videoRecipe).getByTitle("B 站视频教程")).toHaveAttribute(
      "src",
      "https://player.bilibili.com/player.html?bvid=BV1Xt411Z7z8&page=1&autoplay=0"
    );
    expect(within(videoRecipe).getByRole("link", { name: "打开原视频" })).toHaveAttribute(
      "href",
      "https://www.bilibili.com/video/BV1Xt411Z7z8"
    );
    expect(graphicRecipe.compareDocumentPosition(videoRecipe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows rich recipe media from the dish detail page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "查看菜品 番茄炒蛋" }));

    const detail = await screen.findByRole("article", { name: "番茄炒蛋详情" });
    expect(within(detail).getByRole("img", { name: "番茄炒蛋菜品图" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/cover.png"
    );
    expect(within(detail).getByTitle("B 站视频教程")).toHaveAttribute(
      "src",
      "https://player.bilibili.com/player.html?bvid=BV1Xt411Z7z8&page=1&autoplay=0"
    );
    expect(within(detail).getByRole("link", { name: "打开原视频" })).toHaveAttribute(
      "href",
      "https://www.bilibili.com/video/BV1Xt411Z7z8"
    );
    expect(within(detail).getByText("切好番茄")).toBeInTheDocument();
    expect(within(detail).getByRole("img", { name: "步骤 1" })).toHaveAttribute(
      "src",
      "http://localhost:3001/uploads/recipes/step-1.png"
    );
  });

  it("saves recipe cover, video link, and step images from the dish manager", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "菜品管理" }));
    await user.type(screen.getByLabelText("菜名"), "葱油拌面");
    await user.type(screen.getByLabelText("视频链接"), "https://www.bilibili.com/video/BV1Xt411Z7z8");
    expect(await screen.findByText("视频预览")).toBeInTheDocument();
    expect(screen.getByTitle("B 站视频教程")).toHaveAttribute(
      "src",
      "https://player.bilibili.com/player.html?bvid=BV1Xt411Z7z8&page=1&autoplay=0"
    );
    await user.upload(
      screen.getByLabelText("菜品封面"),
      new File(["cover"], "cover.png", { type: "image/png" })
    );
    await user.type(screen.getByLabelText("步骤 1 说明"), "煮面后拌葱油");
    await user.upload(
      screen.getByLabelText("步骤 1 图片"),
      new File(["step"], "step.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: "保存菜品" }));

    await waitFor(() =>
      expect(savedDishPayload).toMatchObject({
        name: "葱油拌面",
        recipe: {
          coverImagePath: "/uploads/recipes/new-cover.png",
          videoUrl: "https://www.bilibili.com/video/BV1Xt411Z7z8",
          stepItems: [{ instruction: "煮面后拌葱油", imagePath: "/uploads/recipes/new-step.png" }]
        }
      })
    );
  });

  it("shows spending stats on the order history tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "订单记录" }));

    expect(await screen.findByText("今日消费")).toBeInTheDocument();
    expect(screen.getByText("本月消费")).toBeInTheDocument();
    expect(screen.getByText("年度消费")).toBeInTheDocument();
    expect(screen.getByText("自定义消费")).toBeInTheDocument();
    expect(screen.getAllByText("¥128.50").length).toBeGreaterThanOrEqual(1);
  });

  it("filters dishes from the real category rail", async () => {
    const user = userEvent.setup();
    mockDishes = [
      ...mockDishes,
      {
        id: 3,
        name: "紫菜蛋花汤",
        category: "汤",
        price: 8,
        description: "清爽快手",
        estimatedMinutes: 8,
        difficulty: "简单",
        isRecommended: false,
        isFavorite: false,
        recipe: {
          ingredients: "紫菜，鸡蛋",
          seasonings: "盐，香油",
          steps: "煮开调味",
          coverImagePath: "",
          videoUrl: "",
          stepItems: []
        }
      }
    ];
    render(<App />);

    await screen.findByText("番茄炒蛋");
    expect(screen.getByText("红烧茄子")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "汤 1" }));
    expect(screen.queryByText("番茄炒蛋")).not.toBeInTheDocument();
    expect(screen.queryByText("红烧茄子")).not.toBeInTheDocument();
    expect(screen.getByText("紫菜蛋花汤")).toBeInTheDocument();
  });

  it("marks a dish as favorite from the dish card", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "喜爱 番茄炒蛋" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/dishes/1/favorite"),
        expect.objectContaining({
          body: JSON.stringify({ isFavorite: true }),
          method: "PATCH"
        })
      )
    );
  });

  it("opens the mobile selected dishes drawer", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "加入餐单 番茄炒蛋" }));

    const mobileCart = await screen.findByRole("region", { name: "移动端已选菜品" });
    expect(within(mobileCart).getByText("已选 1 道")).toBeInTheDocument();
    expect(within(mobileCart).getByText("¥18.00")).toBeInTheDocument();

    await user.click(within(mobileCart).getByRole("button", { name: "查看已选菜品" }));

    const drawer = await screen.findByRole("dialog", { name: "已选菜品" });
    expect(within(drawer).getByText("番茄炒蛋")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "提交订单" })).toBeInTheDocument();
  });

  it("lets mobile diners count be cleared and adjusted", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "加入餐单 番茄炒蛋" }));
    const mobileCart = await screen.findByRole("region", { name: "移动端已选菜品" });
    await user.click(within(mobileCart).getByRole("button", { name: "查看已选菜品" }));

    const drawer = await screen.findByRole("dialog", { name: "已选菜品" });
    const dinersInput = within(drawer).getByLabelText("移动端就餐人数") as HTMLInputElement;
    await user.clear(dinersInput);
    expect(dinersInput.value).toBe("");

    await user.type(dinersInput, "3");
    expect(dinersInput.value).toBe("3");

    await user.clear(dinersInput);
    await user.click(within(drawer).getByRole("button", { name: "增加就餐人数" }));
    expect(dinersInput.value).toBe("2");

    await user.click(within(drawer).getByRole("button", { name: "减少就餐人数" }));
    expect(dinersInput.value).toBe("1");
  });

  it("keeps selected dishes after switching tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "加入餐单 番茄炒蛋" }));
    expect(await screen.findByText("已选 1 份")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "菜品管理" }));
    await screen.findByRole("button", { name: "保存菜品" });
    await user.click(screen.getByRole("button", { name: "点菜" }));

    expect(await screen.findByText("已选 1 份")).toBeInTheDocument();
    expect(screen.getAllByText("已选 1 道").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("¥18.00").length).toBeGreaterThanOrEqual(1);
  });

  it("deletes an order from order history", async () => {
    mockOrders = [orderRecord];
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("番茄炒蛋");
    await user.click(screen.getByRole("button", { name: "订单记录" }));
    await screen.findByText("番茄炒蛋 × 1");
    await user.click(screen.getByRole("button", { name: "删除订单" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/1"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
    await waitFor(() => expect(screen.queryByText("番茄炒蛋 × 1")).not.toBeInTheDocument());
  });
});
