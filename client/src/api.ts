import type { CreateOrderInput, Dish, DishInput, Order, OrderStats, OrderStatsRange } from "./types";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLanHost(hostname: string): boolean {
  return /^(10|127|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(hostname);
}

export function buildApiBase(configuredBase?: string, pageHostname = window.location.hostname): string {
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (isLocalHost(pageHostname) || isLanHost(pageHostname)) {
    return `http://${pageHostname || "localhost"}:3001`;
  }

  return "";
}

const API_BASE = buildApiBase(import.meta.env.VITE_API_BASE);

export function getAssetUrl(path: string): string {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(body.message ?? "请求失败");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function fetchDishes(): Promise<Dish[]> {
  return request<Dish[]>("/api/dishes");
}

export function createDish(input: DishInput): Promise<Dish> {
  return request<Dish>("/api/dishes", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateDish(id: number, input: DishInput): Promise<Dish> {
  return request<Dish>(`/api/dishes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function deleteDish(id: number): Promise<void> {
  return request<void>(`/api/dishes/${id}`, {
    method: "DELETE"
  });
}

export function updateDishFavorite(id: number, isFavorite: boolean): Promise<Dish> {
  return request<Dish>(`/api/dishes/${id}/favorite`, {
    method: "PATCH",
    body: JSON.stringify({ isFavorite })
  });
}

export async function uploadRecipeImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/api/uploads/recipe-image`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "图片上传失败" }));
    throw new Error(body.message ?? "图片上传失败");
  }

  const body = (await response.json()) as { path: string };
  return body.path;
}

export function fetchOrders(): Promise<Order[]> {
  return request<Order[]>("/api/orders");
}

export function fetchOrderStats(range: OrderStatsRange): Promise<OrderStats> {
  const params = new URLSearchParams(range);
  return request<OrderStats>(`/api/orders/stats?${params.toString()}`);
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return request<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateOrderStatus(id: number, status: "pending" | "completed"): Promise<Order> {
  return request<Order>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function deleteOrder(id: number): Promise<void> {
  return request<void>(`/api/orders/${id}`, {
    method: "DELETE"
  });
}
