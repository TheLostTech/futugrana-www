import { describe, it, expect } from "vitest";
import { localizeUrl, isLocale } from "./i18n";

describe("isLocale", () => {
  it("accepts known locales", () => {
    expect(isLocale("it")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });
  it("rejects unknown locales", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});

describe("localizeUrl", () => {
  it("keeps IT default at root", () => {
    expect(localizeUrl("/prezzi", "it")).toBe("/prezzi");
    expect(localizeUrl("/", "it")).toBe("/");
  });
  it("prefixes EN with /en", () => {
    expect(localizeUrl("/prezzi", "en")).toBe("/en/prezzi");
    expect(localizeUrl("/", "en")).toBe("/en");
  });
  it("strips an existing locale prefix before re-applying", () => {
    expect(localizeUrl("/en/prezzi", "it")).toBe("/prezzi");
    expect(localizeUrl("/en/prezzi", "en")).toBe("/en/prezzi");
  });
});
