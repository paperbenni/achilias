import { afterEach, describe, expect, test } from "bun:test";
import { passwordLoginEnabled } from "../src/lib/ilias/login-flags";

const original = {
  origin: process.env.ACHILIAS_ORIGIN,
  flag: process.env.ACHILIAS_PASSWORD_LOGIN,
};
afterEach(() => {
  if (original.origin === undefined) delete process.env.ACHILIAS_ORIGIN;
  else process.env.ACHILIAS_ORIGIN = original.origin;
  if (original.flag === undefined) delete process.env.ACHILIAS_PASSWORD_LOGIN;
  else process.env.ACHILIAS_PASSWORD_LOGIN = original.flag;
});

describe("password sign-in default", () => {
  test("is on by default", () => {
    delete process.env.ACHILIAS_ORIGIN;
    delete process.env.ACHILIAS_PASSWORD_LOGIN;
    expect(passwordLoginEnabled()).toBe(true);
  });

  test("does not depend on the app origin", () => {
    process.env.ACHILIAS_ORIGIN = "https://learn.example.org";
    delete process.env.ACHILIAS_PASSWORD_LOGIN;
    expect(passwordLoginEnabled()).toBe(true);
  });

  test("can be explicitly enabled", () => {
    process.env.ACHILIAS_PASSWORD_LOGIN = "true";
    expect(passwordLoginEnabled()).toBe(true);
  });

  test("can be explicitly disabled", () => {
    process.env.ACHILIAS_PASSWORD_LOGIN = "false";
    expect(passwordLoginEnabled()).toBe(false);
  });
});
