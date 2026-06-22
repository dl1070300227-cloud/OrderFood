import { describe, expect, it } from "vitest";
import { getVideoEmbed } from "./videoEmbed";

describe("getVideoEmbed", () => {
  it("converts bilibili links to an embeddable player", () => {
    expect(getVideoEmbed("https://www.bilibili.com/video/BV1Xt411Z7z8?spm_id_from=333.337.search-card.all.click")).toEqual({
      kind: "iframe",
      originalUrl: "https://www.bilibili.com/video/BV1Xt411Z7z8?spm_id_from=333.337.search-card.all.click",
      src: "https://player.bilibili.com/player.html?bvid=BV1Xt411Z7z8&page=1&autoplay=0",
      title: "B 站视频教程"
    });
  });

  it("uses a native video player for direct video files", () => {
    expect(getVideoEmbed("https://example.com/tutorial.mp4")).toEqual({
      kind: "video",
      originalUrl: "https://example.com/tutorial.mp4",
      src: "https://example.com/tutorial.mp4",
      title: "视频教程"
    });
  });

  it("keeps unsupported pages as external links", () => {
    expect(getVideoEmbed("https://example.com/tutorial")).toEqual({
      kind: "link",
      originalUrl: "https://example.com/tutorial",
      src: "https://example.com/tutorial",
      title: "外部视频链接"
    });
  });
});
