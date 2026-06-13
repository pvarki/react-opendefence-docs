/**
 * Outline Wiki API Client
 *
 * A clean, type-safe client for interacting with the Outline Wiki API.
 * Handles authentication, rate limiting, and data transformation.
 * Ported verbatim from the old wiki pipeline; only the default API base
 * changed (pvarki.getoutline.com instead of app.getoutline.com).
 */

import { rateLimitedFetch } from "./rate-limited-fetch";
import {
  OutlineDocumentStructureSchema,
  DEFAULT_LOCALE,
  normalizeLocale,
} from "./script-types";
import type {
  OutlineNavNode,
  OutlineDocumentInfo,
  LocaleCollection,
} from "./script-types";

// Re-exported so other pipeline modules can type nav trees without reaching
// into script-types.
export type { OutlineNavNode } from "./script-types";

// Configuration

const DEFAULT_API_BASE = "https://pvarki.getoutline.com/api";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function mimeFromExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}

// API Client

export class OutlineApiClient {
  private readonly apiKey: string;
  private readonly apiBase: string;

  constructor(apiKey: string, apiBase: string = DEFAULT_API_BASE) {
    if (!apiKey) {
      throw new Error("Outline API key is required");
    }
    this.apiKey = apiKey;
    this.apiBase = apiBase;
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(accept = "application/json"): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: accept,
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * Make a POST request to the API
   */
  private async post<T>(
    endpoint: string,
    body: Record<string, unknown> = {},
    accept = "application/json",
  ): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const response = await rateLimitedFetch(url, {
      method: "POST",
      headers: this.getHeaders(accept),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Outline API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a POST request and return raw response
   */
  private async postRaw(
    endpoint: string,
    body: Record<string, unknown> = {},
    accept = "application/json, text/markdown",
  ): Promise<Response> {
    const url = `${this.apiBase}${endpoint}`;
    const response = await rateLimitedFetch(url, {
      method: "POST",
      headers: this.getHeaders(accept),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Outline API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response;
  }

  // ==========================================================================
  // Collection Methods
  // ==========================================================================

  /**
   * Fetch the document structure for a collection, organized by locale.
   * Assumes top-level documents are named by locale (e.g., "en", "fi", "sv").
   * Top-level docs with unrecognized titles fall back to DEFAULT_LOCALE,
   * matching the old pipeline's normalizeLocale behavior.
   *
   * @param collectionId - The collection UUID
   * @param rootPath - The base path for document URLs
   */
  async getCollectionStructure(
    collectionId: string,
    rootPath: string,
  ): Promise<LocaleCollection> {
    const data = await this.post<{ data: unknown[] }>(
      "/collections.documents",
      {
        id: collectionId,
      },
    );

    // Parse and validate the structure
    const structure = OutlineDocumentStructureSchema.parse(data.data);

    // Helper to add root path to document URLs
    const addPathToDocument = (doc: OutlineNavNode): OutlineNavNode => {
      const slug = doc.url.slice(doc.url.lastIndexOf("/") + 1);
      return {
        ...doc,
        url: `${rootPath}/${slug}`.replace(/\/+/g, "/"),
        children: doc.children.map(addPathToDocument),
      };
    };

    // Group by locale (top-level docs are locale folders)
    return structure.reduce<LocaleCollection>((acc, doc) => {
      const locale = normalizeLocale(doc.title) ?? DEFAULT_LOCALE;
      acc[locale] = addPathToDocument(doc);
      return acc;
    }, {});
  }

  /**
   * Fetch the document structure for a flat collection (no locale wrapper folders).
   * All documents are placed under DEFAULT_LOCALE ("en").
   * A synthetic root document is created with the collection slug as its title.
   *
   * @param collectionId - The collection UUID
   * @param rootPath - The base path for document URLs
   * @param collectionLabel - Display label for the synthetic root node
   */
  async getCollectionStructureFlat(
    collectionId: string,
    rootPath: string,
    collectionLabel: string,
  ): Promise<LocaleCollection> {
    const data = await this.post<{ data: unknown[] }>(
      "/collections.documents",
      {
        id: collectionId,
      },
    );

    const structure = OutlineDocumentStructureSchema.parse(data.data);

    const addPathToDocument = (doc: OutlineNavNode): OutlineNavNode => {
      const slug = doc.url.slice(doc.url.lastIndexOf("/") + 1);
      return {
        ...doc,
        url: `${rootPath}/${slug}`.replace(/\/+/g, "/"),
        children: doc.children.map(addPathToDocument),
      };
    };

    // Wrap all top-level docs under a synthetic "en" root node
    const syntheticRoot: OutlineNavNode = {
      id: collectionId,
      url: rootPath,
      title: collectionLabel,
      children: structure.map(addPathToDocument),
    };

    return { en: syntheticRoot };
  }

  /**
   * Get top-level documents from a collection
   *
   * @param collectionId - The collection UUID
   */
  async getCollectionDocuments(
    collectionId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    const data = await this.post<{
      data: Array<{ id: string; title: string }>;
    }>("/collections.documents", { id: collectionId });

    return data.data.map((doc) => ({
      id: doc.id,
      title: doc.title,
    }));
  }

  /**
   * List documents, optionally scoped to the direct children of a parent.
   * Used for idempotent find-or-create: look for an existing organizer/page by
   * title under a known parent before creating a new one.
   *
   * @param opts.collectionId     - Restrict to a collection
   * @param opts.parentDocumentId - Restrict to direct children of this document
   * @param opts.limit            - Page size (default 100)
   */
  async listDocuments(
    opts: {
      collectionId?: string;
      parentDocumentId?: string;
      limit?: number;
    } = {},
  ): Promise<Array<{ id: string; title: string }>> {
    const data = await this.post<{
      data: Array<{ id: string; title: string }>;
    }>("/documents.list", {
      ...(opts.collectionId ? { collectionId: opts.collectionId } : {}),
      ...(opts.parentDocumentId
        ? { parentDocumentId: opts.parentDocumentId }
        : {}),
      limit: opts.limit ?? 100,
    });
    return data.data.map((doc) => ({ id: doc.id, title: doc.title }));
  }

  /**
   * List all collections accessible to the API key
   */
  async listCollections(): Promise<
    Array<{ id: string; name: string; description: string }>
  > {
    const data = await this.post<{
      data: Array<{ id: string; name: string; description: string }>;
    }>("/collections.list");

    return data.data;
  }

  /** Create a new collection; returns its UUID. */
  async createCollection(
    name: string,
    description = "",
  ): Promise<{ id: string; name: string }> {
    const data = await this.post<{ data: { id: string; name: string } }>(
      "/collections.create",
      { name, description },
    );
    return { id: data.data.id, name: data.data.name };
  }

  /** Permanently delete a collection and all its documents. */
  async deleteCollection(id: string): Promise<void> {
    await this.post("/collections.delete", { id });
  }

  /** Replace a document's markdown body (keeps title/position). */
  async updateDocument(
    id: string,
    text: string,
    opts: { publish?: boolean } = {},
  ): Promise<void> {
    await this.post("/documents.update", {
      id,
      text,
      ...(opts.publish !== undefined ? { publish: opts.publish } : {}),
    });
  }

  /** Fetch a document's raw markdown body (documents.info `text` field). */
  async getDocumentText(id: string): Promise<string> {
    const data = await this.post<{ data: { text: string } }>(
      "/documents.info",
      { id },
    );
    return data.data.text ?? "";
  }

  // ==========================================================================
  // Document Methods
  // ==========================================================================

  /**
   * Fetch document info (metadata) by ID
   *
   * @param documentId - The document UUID
   */
  async getDocumentInfo(documentId: string): Promise<OutlineDocumentInfo> {
    const data = await this.post<{
      data: {
        id: string;
        url: string;
        title: string;
        collectionId: string;
        createdAt: string;
        updatedAt: string;
      };
    }>("/documents.info", { id: documentId });

    return {
      id: data.data.id,
      url: data.data.url.slice(data.data.url.lastIndexOf("/")),
      title: data.data.title,
      collectionId: data.data.collectionId,
      createdAt: data.data.createdAt,
      updatedAt: data.data.updatedAt,
    };
  }

  /**
   * Export document content (returns Response for handling ZIP or markdown)
   *
   * @param documentId - The document UUID
   */
  async exportDocument(documentId: string): Promise<Response> {
    return this.postRaw(
      "/documents.export",
      { id: documentId },
      "application/json, text/markdown",
    );
  }

  /**
   * Get document as markdown text
   *
   * @param documentId - The document UUID
   */
  async getDocumentAsMarkdown(documentId: string): Promise<string> {
    const response = await this.exportDocument(documentId);
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/zip")) {
      // Handle ZIP export (contains images)
      const arrayBuffer = await response.arrayBuffer();
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(Buffer.from(arrayBuffer));
      const entries = zip.getEntries();

      const mdEntry = entries.find((entry) => entry.entryName.endsWith(".md"));
      if (!mdEntry) {
        throw new Error("No markdown file found in ZIP export");
      }

      return mdEntry.getData().toString("utf8");
    }

    // Direct markdown response
    return response.text();
  }

  /**
   * Download document with all attachments
   *
   * @param documentId - The document UUID
   */
  async downloadDocumentWithImages(
    documentId: string,
  ): Promise<{ markdown: string; images: Map<string, Buffer> }> {
    const response = await this.exportDocument(documentId);
    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/zip")) {
      // No images, just markdown
      const markdown = await response.text();
      return { markdown, images: new Map() };
    }

    const arrayBuffer = await response.arrayBuffer();
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    const entries = zip.getEntries();

    let markdown = "";
    const images = new Map<string, Buffer>();

    for (const entry of entries) {
      if (entry.entryName.endsWith(".md")) {
        markdown = entry.getData().toString("utf8");
      } else if (!entry.isDirectory) {
        images.set(entry.entryName, entry.getData());
      }
    }

    return { markdown, images };
  }

  /**
   * Create a new document in a collection.
   *
   * @param opts.collectionId  - Target collection UUID
   * @param opts.parentDocumentId - Parent doc UUID (creates nested doc)
   * @param opts.title         - Document title
   * @param opts.text          - Markdown body (Outline format)
   * @param opts.publish       - Whether to publish immediately (default true)
   */
  async createDocument(opts: {
    collectionId: string;
    parentDocumentId?: string;
    title: string;
    text: string;
    publish?: boolean;
  }): Promise<{ id: string; title: string; url: string }> {
    const data = await this.post<{
      data: { id: string; title: string; url: string };
    }>("/documents.create", {
      collectionId: opts.collectionId,
      ...(opts.parentDocumentId
        ? { parentDocumentId: opts.parentDocumentId }
        : {}),
      title: opts.title,
      text: opts.text,
      publish: opts.publish ?? true,
    });
    return {
      id: data.data.id,
      title: data.data.title,
      url: data.data.url,
    };
  }

  /**
   * Move/reorder a document to a position among its siblings.
   *
   * @param opts.id               - Document UUID to move
   * @param opts.collectionId     - Collection UUID (kept the same when reordering)
   * @param opts.parentDocumentId - New parent UUID (omit for collection top level)
   * @param opts.index            - Zero-based position among siblings
   */
  async moveDocument(opts: {
    id: string;
    collectionId?: string;
    parentDocumentId?: string;
    index?: number;
  }): Promise<void> {
    await this.post("/documents.move", {
      id: opts.id,
      ...(opts.collectionId ? { collectionId: opts.collectionId } : {}),
      ...(opts.parentDocumentId
        ? { parentDocumentId: opts.parentDocumentId }
        : {}),
      ...(opts.index !== undefined ? { index: opts.index } : {}),
    });
  }

  /**
   * Upload a local file to Outline as an attachment.
   *
   * Two-step flow (mirrors what the Outline editor does when you paste an
   * image): `attachments.create` returns a presigned S3 POST, then the bytes
   * are uploaded directly to S3. Returns the attachment id and the canonical
   * reference URL — the same `attachments.redirect?id=` shape the sync pipeline
   * already downloads, so embedding `![alt](url)` in a document body Just Works.
   *
   * @param filePath - Absolute or cwd-relative path to the file
   * @param opts.name - Override the stored filename (defaults to basename)
   * @param opts.contentType - Override the MIME type (defaults to extension)
   * @param opts.documentId - Associate the attachment with a document
   */
  async uploadAttachment(
    filePath: string,
    opts: { name?: string; contentType?: string; documentId?: string } = {},
  ): Promise<{ id: string; url: string }> {
    const { readFile } = await import("node:fs/promises");
    const { basename, extname } = await import("node:path");
    const bytes = await readFile(filePath);
    const name = opts.name ?? basename(filePath);
    const contentType = opts.contentType ?? mimeFromExt(extname(filePath));

    const { data: created } = await this.post<{
      data: {
        uploadUrl: string;
        form: Record<string, string>;
        attachment: { id: string; url: string };
      };
    }>("/attachments.create", {
      name,
      contentType,
      size: bytes.byteLength,
      preset: "documentAttachment",
      ...(opts.documentId ? { documentId: opts.documentId } : {}),
    });

    // Presigned S3 POST: every form field first, the file blob LAST, no auth
    // header (the signature lives in the form policy).
    const fd = new FormData();
    for (const [key, value] of Object.entries(created.form)) {
      fd.append(key, value);
    }
    fd.append("file", new Blob([bytes], { type: contentType }), name);

    const upload = await fetch(created.uploadUrl, { method: "POST", body: fd });
    if (!upload.ok) {
      const errText = await upload.text().catch(() => "");
      throw new Error(
        `Attachment upload failed for ${name}: ${upload.status} ${upload.statusText} - ${errText.slice(0, 300)}`,
      );
    }

    // attachment.url is relative ("/api/attachments.redirect?id=..."); make it
    // absolute against the instance origin so the markdown reference resolves.
    const origin = this.apiBase.replace(/\/api\/?$/, "");
    return {
      id: created.attachment.id,
      url: `${origin}${created.attachment.url}`,
    };
  }

  /**
   * Search documents
   *
   * @param query - Search query string
   * @param collectionId - Optional collection to search within
   */
  async searchDocuments(
    query: string,
    collectionId?: string,
  ): Promise<Array<{ id: string; title: string; url: string }>> {
    const body: Record<string, unknown> = { query };
    if (collectionId) {
      body.collectionId = collectionId;
    }

    const data = await this.post<{
      data: Array<{
        document: { id: string; title: string; url: string };
      }>;
    }>("/documents.search", body);

    return data.data.map((result) => ({
      id: result.document.id,
      title: result.document.title,
      url: result.document.url,
    }));
  }
}

// Factory Function

/**
 * Create an Outline API client from environment variables
 */
export function createOutlineClient(): OutlineApiClient {
  const apiKey = process.env.OUTLINE_API_KEY;
  const apiBase = process.env.OUTLINE_API_BASE || DEFAULT_API_BASE;

  if (!apiKey) {
    throw new Error("OUTLINE_API_KEY environment variable is required");
  }

  return new OutlineApiClient(apiKey, apiBase);
}
