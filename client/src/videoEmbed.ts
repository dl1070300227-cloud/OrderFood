export type VideoEmbed =
  | {
      kind: "iframe";
      originalUrl: string;
      src: string;
      title: string;
    }
  | {
      kind: "video";
      originalUrl: string;
      src: string;
      title: string;
    }
  | {
      kind: "link";
      originalUrl: string;
      src: string;
      title: string;
    };

const directVideoPattern = /\.(mp4|webm|ogg)(?:$|[?#])/i;

function extractBilibiliBvid(url: string): string {
  const match = url.match(/BV[a-zA-Z0-9]+/);
  return match?.[0] ?? "";
}

export function getVideoEmbed(rawUrl: string): VideoEmbed | null {
  const originalUrl = rawUrl.trim();
  if (!originalUrl) {
    return null;
  }

  const bilibiliBvid = extractBilibiliBvid(originalUrl);
  if (bilibiliBvid) {
    return {
      kind: "iframe",
      originalUrl,
      src: `https://player.bilibili.com/player.html?bvid=${bilibiliBvid}&page=1&autoplay=0`,
      title: "B 站视频教程"
    };
  }

  if (directVideoPattern.test(originalUrl)) {
    return {
      kind: "video",
      originalUrl,
      src: originalUrl,
      title: "视频教程"
    };
  }

  return {
    kind: "link",
    originalUrl,
    src: originalUrl,
    title: "外部视频链接"
  };
}
