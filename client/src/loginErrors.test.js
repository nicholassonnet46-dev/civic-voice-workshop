import { describe, expect, it } from "vitest";
import { describeLoginError, formatRetryWait } from "./loginErrors.js";

describe("login error messages", () => {
  it("formats the wait time in seconds or minutes", () => {
    expect(formatRetryWait(1)).toBe("1 second");
    expect(formatRetryWait(45)).toBe("45 seconds");
    expect(formatRetryWait(60)).toBe("1 minute");
    expect(formatRetryWait(900)).toBe("15 minutes");
    expect(formatRetryWait(61)).toBe("2 minutes");
  });

  it("falls back to a vague wait when the retry time is unknown", () => {
    expect(formatRetryWait(undefined)).toBe("a few minutes");
    expect(formatRetryWait(null)).toBe("a few minutes");
    expect(formatRetryWait("soon")).toBe("a few minutes");
    expect(formatRetryWait(0)).toBe("a few minutes");
  });

  it("explains a 429 with the wait time", () => {
    const error = Object.assign(new Error("Too many failed sign-in attempts. Try again in 900 seconds."), {
      status: 429, retryAfterSeconds: 900,
    });
    expect(describeLoginError(error)).toBe(
      "Too many failed sign-in attempts. Please wait 15 minutes before trying again.",
    );
  });

  it("keeps the API message for other failures", () => {
    const error = Object.assign(new Error("Invalid NRIC, password, or sign-in mode."), { status: 401 });
    expect(describeLoginError(error)).toBe("Invalid NRIC, password, or sign-in mode.");
    expect(describeLoginError(new Error("Failed to fetch"))).toBe("Failed to fetch");
    expect(describeLoginError(null)).toBe("Something went wrong.");
  });
});
