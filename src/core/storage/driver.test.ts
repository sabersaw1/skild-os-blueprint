import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserStorageDriver,
  createFailingStorageDriver,
  createMemoryStorageDriver,
  getStorageDriver,
  resetStorageDriver,
  setStorageDriver,
} from "./driver";
import { readJson, writeJson } from "./local-kv";
import { assertPersisted, PersistenceError } from "./persistence";
import * as emitter from "@/core/activity/emitter";

afterEach(() => {
  resetStorageDriver();
  vi.restoreAllMocks();
});

describe("StorageDriver seam", () => {
  it("defaults to the browser driver and is swappable at bootstrap", () => {
    expect(getStorageDriver().id).toBe(browserStorageDriver.id);
    setStorageDriver(createMemoryStorageDriver());
    expect(getStorageDriver().id).toBe("memory");
    resetStorageDriver();
    expect(getStorageDriver().id).toBe(browserStorageDriver.id);
  });

  it("persists without any DOM when a non-browser driver is installed", () => {
    // This is the Phase 13 audit finding: writes used to fail outright with
    // no `window`. With a driver installed, the contract is environment
    // independent.
    const memory = createMemoryStorageDriver();
    setStorageDriver(memory);
    expect(writeJson("skildos.test.kv.v1", { a: 1 })).toBe(true);
    expect(readJson("skildos.test.kv.v1", null)).toEqual({ a: 1 });
    expect(Object.keys(memory.snapshot())).toContain("skildos.test.kv.v1");
  });

  it("reports failure (and emits) when the driver refuses the write", () => {
    const spy = vi.spyOn(emitter, "emit").mockImplementation(() => undefined);
    setStorageDriver(createFailingStorageDriver());
    expect(writeJson("skildos.test.kv.v1", { a: 1 })).toBe(false);
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toContain("system.storage.quotaExceeded");
  });

  it("turns an unconfirmed write into PersistenceError, so no event is emitted", () => {
    vi.spyOn(emitter, "emit").mockImplementation(() => undefined);
    setStorageDriver(createFailingStorageDriver());
    expect(() =>
      assertPersisted("skildos.test.kv.v1", writeJson("skildos.test.kv.v1", 1)),
    ).toThrow(PersistenceError);
  });

  it("falls back to the default on read when the driver is unavailable", () => {
    setStorageDriver({
      id: "offline",
      durable: false,
      available: () => false,
      read: () => "should never be read",
      write: () => true,
      remove: () => {},
    });
    expect(readJson("skildos.test.kv.v1", "fallback")).toBe("fallback");
  });
});
