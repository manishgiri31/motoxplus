import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Highlight } from "./highlight";

const html = (text: string, query: string) => renderToStaticMarkup(createElement(Highlight, { text, query }));

describe("Highlight", () => {
  it("marks every case-insensitive occurrence of each query word", () => {
    expect(html("Brake shoe for Splendor brake drum", "BRAKE spl")).toBe(
      "<mark>Brake</mark> shoe for <mark>Spl</mark>endor <mark>brake</mark> drum"
    );
  });

  it("prefers the longest word when words overlap", () => {
    expect(html("Clutch plate", "c clutch")).toBe("<mark>Clutch</mark> plate");
  });

  it("escapes markup in titles instead of rendering it", () => {
    expect(html('<img src=x onerror="alert(1)"> pad', "pad")).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <mark>pad</mark>"
    );
  });

  it("treats regex characters in the query literally", () => {
    expect(html("Oil seal (25/40) + O-ring", "(25/40) +")).toBe("Oil seal <mark>(25/40)</mark> <mark>+</mark> O-ring");
    expect(html("abc", ".*")).toBe("abc");
  });

  it("returns the text unchanged for an empty query", () => {
    expect(html("Headlight", "   ")).toBe("Headlight");
  });
});
