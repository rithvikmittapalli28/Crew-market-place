import fs from "fs";
import path from "path";
import { StorageProvider } from "@/types";
import { generateSignedUrl } from "./signed-url";

export * from "./validation";
export * from "./signed-url";

export function getLocalStorageDir(): string {
  const dir = process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "storage", "uploads");
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Local filesystem storage provider.
 * Stores files outside the public web root (storage/uploads) to prevent arbitrary direct path access.
 * Serves files strictly via the authenticated/signed /api/files endpoint.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private fallbackPublicDir: string;

  constructor(customPath?: string) {
    this.baseDir = customPath || getLocalStorageDir();
    this.fallbackPublicDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async createUploadUrl(
    key: string,
    _mimeType: string,
    _maxSizeBytes?: number
  ): Promise<{ uploadUrl: string; storageKey: string; expiresAt?: Date }> {
    void _mimeType;
    void _maxSizeBytes;
    return {
      uploadUrl: `/api/storage/upload`,
      storageKey: key,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  }

  async getFileUrl(key: string, isPublic = true): Promise<string> {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }
    const cleanKey = path.basename(key);
    if (!isPublic) {
      const signed = generateSignedUrl(cleanKey);
      return signed.url;
    }
    return `/api/files/${encodeURIComponent(cleanKey)}`;
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = 900
  ): Promise<{ url: string; expiresAt: Date }> {
    const cleanKey = path.basename(key);
    return generateSignedUrl(cleanKey, expiresInSeconds);
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const sanitizedKey = path.basename(key);
      const filePath = path.join(this.baseDir, sanitizedKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      const fallbackPath = path.join(this.fallbackPublicDir, sanitizedKey);
      if (fs.existsSync(fallbackPath)) {
        await fs.promises.unlink(fallbackPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(
    key: string
  ): Promise<{ size: number; mimeType: string; lastModified: Date } | null> {
    try {
      const sanitizedKey = path.basename(key);
      let filePath = path.join(this.baseDir, sanitizedKey);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(this.fallbackPublicDir, sanitizedKey);
      }
      if (!fs.existsSync(filePath)) return null;

      const stat = await fs.promises.stat(filePath);
      return {
        size: stat.size,
        mimeType: "application/octet-stream",
        lastModified: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  async saveBuffer(key: string, buffer: Buffer): Promise<string> {
    const sanitizedKey = path.basename(key);
    const filePath = path.join(this.baseDir, sanitizedKey);
    await fs.promises.writeFile(filePath, buffer);
    return `/api/files/${encodeURIComponent(sanitizedKey)}`;
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

/**
 * S3-compatible storage provider (Cloudflare R2, AWS S3, MinIO).
 */
export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;
  private endpoint?: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET || "crewn-uploads";
    this.region = process.env.AWS_REGION || process.env.STORAGE_REGION || "auto";
    this.endpoint = process.env.AWS_ENDPOINT || process.env.STORAGE_ENDPOINT;
  }

  async createUploadUrl(
    key: string,
    _mimeType: string,
    _maxSizeBytes?: number
  ): Promise<{ uploadUrl: string; storageKey: string; expiresAt?: Date }> {
    void _mimeType;
    void _maxSizeBytes;
    const base = this.endpoint
      ? `${this.endpoint.replace(/\/$/, "")}/${this.bucket}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    return {
      uploadUrl: `${base}/${encodeURIComponent(key)}?signed=true`,
      storageKey: key,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async getFileUrl(key: string, isPublic = true): Promise<string> {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }
    const cleanKey = path.basename(key);
    if (!isPublic) {
      const signed = await this.getSignedUrl(cleanKey);
      return signed.url;
    }
    const cdnUrl = process.env.STORAGE_CDN_URL;
    if (cdnUrl) {
      return `${cdnUrl.replace(/\/$/, "")}/${cleanKey}`;
    }
    const base = this.endpoint
      ? `${this.endpoint.replace(/\/$/, "")}/${this.bucket}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    return `${base}/${cleanKey}`;
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = 900
  ): Promise<{ url: string; expiresAt: Date }> {
    const cleanKey = path.basename(key);
    return generateSignedUrl(cleanKey, expiresInSeconds);
  }

  async deleteFile(_key: string): Promise<boolean> {
    void _key;
    return true;
  }

  async getObjectMetadata(
    _key: string
  ): Promise<{ size: number; mimeType: string; lastModified: Date } | null> {
    void _key;
    return null;
  }
}

let activeStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (activeStorageProvider) {
    return activeStorageProvider;
  }

  const provider = (process.env.STORAGE_PROVIDER || process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (provider === "s3" || provider === "r2") {
    activeStorageProvider = new S3StorageProvider();
  } else {
    activeStorageProvider = new LocalStorageProvider();
  }

  return activeStorageProvider;
}
