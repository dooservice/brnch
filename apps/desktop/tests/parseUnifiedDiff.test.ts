import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "../src/state/parseUnifiedDiff";

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 111..222 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -10,3 +10,4 @@ function a()",
  " keep",
  "-old",
  "+new",
  "+extra",
  " tail",
  "diff --git a/logo.png b/logo.png",
  "Binary files a/logo.png and b/logo.png differ",
].join("\n");

describe("parseUnifiedDiff", () => {
  it("splits files, counts changes and numbers lines on both sides", () => {
    const [file] = parseUnifiedDiff(DIFF);

    expect(file).toMatchObject({ path: "src/a.ts", added: 2, removed: 1, isBinary: false });
    expect(file!.lines.map((line) => [line.kind, line.oldNumber, line.newNumber, line.text])).toEqual([
      ["hunk", null, null, "@@ -10,3 +10,4 @@ function a()"],
      ["context", 10, 10, "keep"],
      ["remove", 11, null, "old"],
      ["add", null, 11, "new"],
      ["add", null, 12, "extra"],
      ["context", 12, 13, "tail"],
    ]);
  });

  it("marks a binary file instead of inventing lines", () => {
    const files = parseUnifiedDiff(DIFF);

    expect(files[1]).toMatchObject({ path: "logo.png", isBinary: true, lines: [] });
  });

  it("returns nothing for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});
