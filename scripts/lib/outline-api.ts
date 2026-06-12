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
