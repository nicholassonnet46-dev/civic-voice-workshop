import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  nextTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeAttributes,
  toggleTheme,
} from "./theme.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe("resolveTheme", () => {
  it("follows the OS preference when nothing is stored", () => {
    expect(resolveTheme({ storage: memoryStorage(), prefersDark: true })).toBe("dark");
    expect(resolveTheme({ storage: memoryStorage(), prefersDark: false })).toBe("light");
  });

  it("prefers the stored choice over the OS preference", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "light" });
    expect(resolveTheme({ storage, prefersDark: true })).toBe("light");
    const dark = memoryStorage({ [STORAGE_KEY]: "dark" });
    expect(resolveTheme({ storage: dark, prefersDark: false })).toBe("dark");
  });

  it("ignores unknown stored values", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "sepia" });
    expect(readStoredTheme(storage)).toBeNull();
    expect(resolveTheme({ storage, prefersDark: true })).toBe("dark");
  });

  it("tolerates missing or throwing storage", () => {
    expect(resolveTheme({ storage: undefined, prefersDark: false })).toBe("light");
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(resolveTheme({ storage: broken, prefersDark: true })).toBe("dark");
    expect(toggleTheme({ storage: broken, prefersDark: true })).toBe("light");
  });
});

describe("toggleTheme", () => {
  it("flips the effective theme and persists the choice", () => {
    const storage = memoryStorage();
    expect(toggleTheme({ storage, prefersDark: true })).toBe("light");
    expect(storage.getItem(STORAGE_KEY)).toBe("light");
    expect(toggleTheme({ storage, prefersDark: true })).toBe("dark");
    expect(storage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("persisted choice survives a change in OS preference", () => {
    const storage = memoryStorage();
    toggleTheme({ storage, prefersDark: false }); // user picks dark
    expect(resolveTheme({ storage, prefersDark: false })).toBe("dark");
    expect(resolveTheme({ storage, prefersDark: true })).toBe("dark");
  });
});

describe("helpers", () => {
  it("nextTheme alternates", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("persistTheme rejects unknown themes", () => {
    expect(() => persistTheme(memoryStorage(), "neon")).toThrow(/Unknown theme/);
  });

  it("themeAttributes yields the data-theme attribute", () => {
    expect(themeAttributes("dark")).toEqual({ "data-theme": "dark" });
  });
});
