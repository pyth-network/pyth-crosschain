import type { RssChannel, RssItem } from "./feed";
import { buildFeedXml, escapeXml } from "./feed";

describe("escapeXml", () => {
  it("escapes & first so entities are never double-escaped", () => {
    expect(escapeXml("<")).toBe("&lt;");
    expect(escapeXml("a<b&c")).toBe("a&lt;b&amp;c");
    // The `&` from `&lt;` must not itself be re-escaped into `&amp;lt;`.
    expect(escapeXml("<b>")).not.toContain("&amp;lt;");
  });

  it("escapes all five XML metacharacters", () => {
    expect(escapeXml(`<b>"x" & 'y'</b>`)).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; &apos;y&apos;&lt;/b&gt;",
    );
  });

  it("leaves a plain string unchanged", () => {
    expect(escapeXml("plain text 123")).toBe("plain text 123");
  });
});

describe("buildFeedXml", () => {
  const channel: RssChannel = {
    description: "desc",
    lastBuildDate: "Mon, 20 Jul 2026 00:00:00 GMT",
    link: "https://docs.pyth.network/changelog",
    self: "https://docs.pyth.network/changelog/feed.xml",
    title: "Pyth Changelog",
  };

  const item: RssItem = {
    categories: ["Pyth Pro", "Feature"],
    contentHtml: "<p>hi & bye</p>",
    link: "https://docs.pyth.network/changelog#slug",
    pubDate: "Mon, 20 Jul 2026 00:00:00 GMT",
    title: "Title & <tag>",
  };

  it("produces a well-formed channel with escaped dynamic strings", () => {
    const xml = buildFeedXml(channel, [item]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("<title>Pyth Changelog</title>");
    expect(xml).toContain("<title>Title &amp; &lt;tag&gt;</title>");
    expect(xml).toContain(
      "<content:encoded>&lt;p&gt;hi &amp; bye&lt;/p&gt;</content:encoded>",
    );
    expect(xml).toContain("<category>Pyth Pro</category>");
    expect(xml).toContain("<category>Feature</category>");
    expect(xml).toContain(
      '<guid isPermaLink="true">https://docs.pyth.network/changelog#slug</guid>',
    );
  });

  it("renders a valid channel with no items", () => {
    const xml = buildFeedXml(channel, []);
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).not.toContain("<item>");
  });
});
