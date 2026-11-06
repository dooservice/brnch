export type DiffLineKind = "hunk" | "add" | "remove" | "context";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly oldNumber: number | null;
  readonly newNumber: number | null;
  readonly text: string;
}

export interface DiffFile {
  readonly path: string;
  readonly added: number;
  readonly removed: number;
  readonly isBinary: boolean;
  readonly lines: readonly DiffLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Reads the unified diff gitd returns into files and numbered lines. */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: { path: string; added: number; removed: number; isBinary: boolean; lines: DiffLine[] } | null = null;
  let oldNumber = 0;
  let newNumber = 0;
  let insideHunk = false;

  const close = () => {
    if (current) {
      files.push(current);
    }
  };

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      close();
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      current = { path: match?.[2] ?? line.slice(11), added: 0, removed: 0, isBinary: false, lines: [] };
      insideHunk = false;
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      current.isBinary = true;
      continue;
    }
    const hunk = HUNK_HEADER.exec(line);
    if (hunk) {
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      insideHunk = true;
      current.lines.push({ kind: "hunk", oldNumber: null, newNumber: null, text: line });
      continue;
    }
    if (!insideHunk) {
      continue;
    }
    if (line.startsWith("+")) {
      current.added += 1;
      current.lines.push({ kind: "add", oldNumber: null, newNumber, text: line.slice(1) });
      newNumber += 1;
    } else if (line.startsWith("-")) {
      current.removed += 1;
      current.lines.push({ kind: "remove", oldNumber, newNumber: null, text: line.slice(1) });
      oldNumber += 1;
    } else if (line.startsWith(" ")) {
      current.lines.push({ kind: "context", oldNumber, newNumber, text: line.slice(1) });
      oldNumber += 1;
      newNumber += 1;
    }
  }
  close();
  return files;
}
