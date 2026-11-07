import { afterEach, describe, expect, test } from "bun:test";
import { configuredOrigin, isHttpsOrigin } from "../src/lib/ilias/origin";

const original = process.env.ACHILIAS_ORIGIN;
afterEach(() => {
  if (original === undefined) delete process.env.ACHILIAS_ORIGIN;
  else process.env.ACHILIAS_ORIGIN = original;
});

describe("configured app origin", () => {
  test("trims whitespace and trailing slashes", () => {
    process.env.ACHILIAS_ORIGIN = "  https://learn.example.org///  ";
    expect(configuredOrigin()).toBe("https://learn.example.org");
  });

  test("returns undefined when unset or blank", () => {
    delete process.env.ACHILIAS_ORIGIN;
    expect(configuredOrigin()).toBeUndefined();
    process.env.ACHILIAS_ORIGIN = "   ";
    expect(configuredOrigin()).toBeUndefined();
  });

  test("recognizes HTTPS origins case-insensitively", () => {
    process.env.ACHILIAS_ORIGIN = "HTTPS://learn.example.org";
    expect(isHttpsOrigin()).toBe(true);
    process.env.ACHILIAS_ORIGIN = "http://127.0.0.1:3000";
    expect(isHttpsOrigin()).toBe(false);
  });
});
