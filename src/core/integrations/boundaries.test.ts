// Static boundary tests: the integration layer must not import concrete
// business repositories, provider SDKs, or raw localStorage.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/core/integrations");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

const files = walk(ROOT).filter((f) => !f.endsWith(".test.ts"));

describe("integration layer boundaries", () => {
  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("never imports a concrete module repository implementation", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/@\/modules\/[a-z-]+\/data\/local-repository/);
      expect(src, file).not.toMatch(/from ["']@\/modules\//);
    }
  });

  it("never touches localStorage directly", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(code, file).not.toMatch(/localStorage\./);
    }
  });

  it("never imports a provider SDK", () => {
    const banned = [
      "googleapis",
      "google-auth-library",
      "ebay-api",
      "@aws-sdk",
      "stripe",
      "nodemailer",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const pkg of banned) {
        expect(src.includes(`from "${pkg}`), `${file} imports ${pkg}`).toBe(
          false,
        );
      }
    }
  });

  it("business modules do not import provider SDKs or the adapters folder", () => {
    const moduleFiles = walk(join(process.cwd(), "src/modules")).filter(
      (f) => !f.includes(".test."),
    );
    for (const file of moduleFiles) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/core\/integrations\/adapters/);
      expect(src, file).not.toMatch(/googleapis|ebay-api|@aws-sdk/);
    }
  });
});
