export type Recipe = {
  ingredients: string;
  seasonings: string;
  steps: string;
  coverImagePath: string;
  videoUrl: string;
  stepItems: RecipeStep[];
};

export type RecipeStep = {
  id?: number;
  stepOrder: number;
  instruction: string;
  imagePath: string;
};

export type Dish = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  estimatedMinutes: number | null;
  difficulty: string;
  isRecommended: boolean;
  recipe: Recipe;
};

export type DishInput = Omit<Dish, "id">;

export type OrderItem = {
  id: number;
  orderId: number;
  dishId: number | null;
  dishName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Order = {
  id: number;
  orderedAt: string;
  dinersCount: number;
  note: string;
  totalPrice: number;
  status: "pending" | "completed";
  items: OrderItem[];
};

export type CartItem = {
  dish: Dish;
  quantity: number;
};

export type CreateOrderInput = {
  dinersCount: number;
  note: string;
  items: Array<{
    dishId: number;
    quantity: number;
  }>;
};
