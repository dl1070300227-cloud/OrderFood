import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { commonDishes } from "../src/db/commonDishes";
import { recipeVideos, type RecipeVideo } from "../src/db/recipeVideos";

type BilibiliSearchItem = {
  title?: string;
  bvid?: string;
  play?: number | string;
  arcurl?: string;
};

type BilibiliSearchResponse = {
  code?: number;
  data?: {
    result?: BilibiliSearchItem[];
  };
};

type BilibiliAllSearchResponse = {
  code?: number;
  data?: {
    result?: Array<{
      result_type?: string;
      data?: BilibiliSearchItem[];
    }>;
  };
};

const outputPath = resolve("src/db/recipeVideos.ts");
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function parsePlayCount(value: number | string | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (!value) {
    return 0;
  }
  if (value.includes("万")) {
    return Math.round(Number(value.replace("万", "")) * 10000);
  }
  return Number(value) || 0;
}

function toRecipeVideo(dishName: string, item: BilibiliSearchItem | undefined): RecipeVideo | null {
  if (!item?.bvid) {
    return null;
  }
  return {
    title: stripHtml(item.title ?? `${dishName} 做法`),
    play: parsePlayCount(item.play),
    url: `https://www.bilibili.com/video/${item.bvid}`,
    bvid: item.bvid,
    source: "bilibili",
    updatedAt: new Date().toISOString()
  };
}

async function fetchTopVideoFromTypeSearch(dishName: string): Promise<RecipeVideo | null> {
  const query = `${dishName} 做法`;
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("order", "click");
  url.searchParams.set("keyword", query);
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: {
      Referer: "https://search.bilibili.com/",
      "User-Agent": userAgent
    }
  });
  if (!response.ok) {
    throw new Error(`Bilibili search failed for ${dishName}: ${response.status}`);
  }

  const body = (await response.json()) as BilibiliSearchResponse;
  const first = body.data?.result?.find((item) => item.bvid);
  return toRecipeVideo(dishName, first);
}

async function fetchTopVideoFromAllSearch(dishName: string): Promise<RecipeVideo | null> {
  const query = `${dishName} 做法`;
  const url = new URL("https://api.bilibili.com/x/web-interface/search/all/v2");
  url.searchParams.set("order", "click");
  url.searchParams.set("keyword", query);

  const response = await fetch(url, {
    headers: {
      Referer: "https://search.bilibili.com/",
      "User-Agent": userAgent
    }
  });
  if (!response.ok) {
    throw new Error(`Bilibili all search failed for ${dishName}: ${response.status}`);
  }

  const body = (await response.json()) as BilibiliAllSearchResponse;
  const videoGroup = body.data?.result?.find((group) => group.result_type === "video");
  const first = videoGroup?.data?.find((item) => item.bvid);
  return toRecipeVideo(dishName, first);
}

async function fetchTopVideo(dishName: string): Promise<RecipeVideo | null> {
  try {
    return await fetchTopVideoFromTypeSearch(dishName);
  } catch (error) {
    console.warn(`${dishName}: type search failed, trying all search`);
    return fetchTopVideoFromAllSearch(dishName);
  }
}

async function fetchTopVideoWithRetry(dishName: string): Promise<RecipeVideo | null> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchTopVideo(dishName);
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.warn(`${dishName}: retry ${attempt}/${attempts - 1}`);
      await sleep(5000 * attempt);
    }
  }
  return null;
}

function renderRecipeVideos(videos: Record<string, RecipeVideo>): string {
  return `export type RecipeVideo = {
  title: string;
  play: number;
  url: string;
  bvid: string;
  source: "bilibili";
  updatedAt: string;
};

export const recipeVideos: Record<string, RecipeVideo> = ${JSON.stringify(videos, null, 2)};
`;
}

async function main() {
  const forceRefresh = process.env.FORCE_REFRESH_RECIPE_VIDEOS === "1";
  const videos: Record<string, RecipeVideo> = forceRefresh ? {} : { ...recipeVideos };
  for (const dish of commonDishes) {
    if (!forceRefresh && videos[dish.name]) {
      console.log(`${dish.name}: kept ${videos[dish.name].bvid} ${videos[dish.name].play}`);
      continue;
    }

    try {
      const video = await fetchTopVideoWithRetry(dish.name);
      if (video) {
        videos[dish.name] = video;
        console.log(`${dish.name}: ${video.bvid} ${video.play}`);
      } else {
        console.log(`${dish.name}: no result`);
      }
    } catch (error) {
      console.warn(`${dish.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    await sleep(2000);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderRecipeVideos(videos), "utf8");
  console.log(`Wrote ${Object.keys(videos).length} videos to ${outputPath}`);
}

void main();
