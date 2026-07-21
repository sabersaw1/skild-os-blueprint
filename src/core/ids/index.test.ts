import { describe, it, expect } from "vitest";
import { newId } from "./index";

describe("newId", () => {
  it("returns a UUID v4 format string", () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("produces unique values across many calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 2000; i++) set.add(newId());
    expect(set.size).toBe(2000);
  });
});
