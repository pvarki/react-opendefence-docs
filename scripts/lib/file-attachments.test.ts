// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isFileAttachment,
  processDocumentFiles,
  updateFileReferences,
} from "./file-attachments";

const pdf = Buffer.from("%PDF-1.4\n% test\n");

function hash16(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

describe("isFileAttachment", () => {
  it("accepts PDFs in any case and leaves images to image-processor", () => {
    expect(isFileAttachment("attachments/a.pdf")).toBe(true);
    expect(isFileAttachment("attachments/A.PDF")).toBe(true);
    expect(isFileAttachment("attachments/a.png")).toBe(false);
  });
});

describe("processDocumentFiles", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    tmp = await mkdtemp(path.join(os.tmpdir(), "file-attachments-test-"));
    process.chdir(tmp);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(tmp, { recursive: true, force: true });
  });

  it("stores PDFs under their content hash and skips other entries", async () => {
    const result = await processDocumentFiles(
      new Map([
        ["attachments/manual.pdf", pdf],
        ["attachments/shot.png", Buffer.from("png")],
      ]),
      "[m](attachments/manual.pdf) ![s](attachments/shot.png)",
    );
    const src = `/content/files/${hash16(pdf)}.pdf`;
    expect([...result.files]).toEqual([["attachments/manual.pdf", src]]);
    expect(result.tooLarge).toEqual([]);
    expect(await readFile(path.join(tmp, "public", src))).toEqual(pdf);
  });

  it("stores the same file once when two pages link it", async () => {
    await processDocumentFiles(
      new Map([["attachments/en.pdf", pdf]]),
      "[en](attachments/en.pdf)",
    );
    await processDocumentFiles(
      new Map([["attachments/fi.pdf", pdf]]),
      "[fi](attachments/fi.pdf)",
    );
    expect(await readdir(path.join(tmp, "public/content/files"))).toEqual([
      `${hash16(pdf)}.pdf`,
    ]);
  });

  it("leaves out files over the size limit", async () => {
    const result = await processDocumentFiles(
      new Map([["attachments/big.pdf", pdf]]),
      "[big](attachments/big.pdf)",
      pdf.length - 1,
    );
    expect(result.files.size).toBe(0);
    expect(result.tooLarge).toEqual([
      { entryName: "attachments/big.pdf", bytes: pdf.length },
    ]);
  });
});

describe("processDocumentFiles without a link", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    tmp = await mkdtemp(path.join(os.tmpdir(), "file-attachments-test-"));
    process.chdir(tmp);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(tmp, { recursive: true, force: true });
  });

  it("does not publish an attachment the text does not link", async () => {
    const result = await processDocumentFiles(
      new Map([["attachments/unlinked.pdf", pdf]]),
      "No links here.",
    );
    expect(result.files.size).toBe(0);
    expect(result.tooLarge).toEqual([]);
  });
});

describe("updateFileReferences", () => {
  const files = new Map([
    ["attachments/fbcd454c-87f1.pdf", "/content/files/0123456789abcdef.pdf"],
  ]);

  it("rewrites the relative export link and keeps the label", () => {
    expect(
      updateFileReferences(
        "[ATAK 5.6 Bloodhound.pdf 1234567](attachments/fbcd454c-87f1.pdf)",
        files,
      ),
    ).toBe(
      "[ATAK 5.6 Bloodhound.pdf 1234567](/content/files/0123456789abcdef.pdf)",
    );
  });

  it("rewrites absolute and missing-slash Outline URLs, titles and hrefs", () => {
    const md = [
      "[a](https://pvarki.getoutline.com/attachments/fbcd454c-87f1.pdf)",
      "[b](https://pvarki.getoutline.comattachments/fbcd454c-87f1.pdf)",
      '[c](attachments/fbcd454c-87f1.pdf "Manual")',
      '<a href="attachments/fbcd454c-87f1.pdf">d</a>',
    ].join("\n");
    expect(updateFileReferences(md, files)).toBe(
      [
        "[a](/content/files/0123456789abcdef.pdf)",
        "[b](/content/files/0123456789abcdef.pdf)",
        '[c](/content/files/0123456789abcdef.pdf "Manual")',
        '<a href="/content/files/0123456789abcdef.pdf">d</a>',
      ].join("\n"),
    );
  });

  it("leaves other links alone", () => {
    const md =
      "[x](attachments/other.pdf) [y](https://example.com/fbcd454c-87f1.pdf)";
    expect(updateFileReferences(md, files)).toBe(md);
  });
});
