import { describe, it, expect, beforeEach } from "vitest";
import {
  registerRepository,
  getRepository,
  subscribeRepository,
  resetRegistryForTests,
} from "./registry";

const KEY = "test.thing";

interface Fake {
  name: string;
}

describe("data registry", () => {
  beforeEach(() => {
    resetRegistryForTests();
  });

  it("throws when reading an unregistered key", () => {
    expect(() => getRepository<Fake>(KEY)).toThrow(/no repository/i);
  });

  it("returns the registered implementation", () => {
    registerRepository<Fake>(KEY, { name: "a" });
    expect(getRepository<Fake>(KEY).name).toBe("a");
  });

  it("supports swapping implementations at runtime", () => {
    registerRepository<Fake>(KEY, { name: "a" });
    registerRepository<Fake>(KEY, { name: "b" });
    expect(getRepository<Fake>(KEY).name).toBe("b");
  });

  it("notifies subscribers when a key is (re)registered", () => {
    let calls = 0;
    const unsub = subscribeRepository(KEY, () => {
      calls++;
    });
    registerRepository<Fake>(KEY, { name: "a" });
    registerRepository<Fake>(KEY, { name: "b" });
    unsub();
    registerRepository<Fake>(KEY, { name: "c" });
    expect(calls).toBe(2);
  });
});
