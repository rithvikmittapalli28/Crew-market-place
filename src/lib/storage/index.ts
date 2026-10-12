import fs from "fs";
import path from "path";
import { StorageProvider } from "@/types";
import { generateSignedUrl } from "./signed-url";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3PresignedUrl } from "@aws-sdk/s3-request-presigner";

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
 * Real production S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO).
 * Performs actual AWS SDK S3 calls for upload, delete, metadata, and presigned URLs.
 */
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private endpoint?: string;

  constructor(options?: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }) {
    this.bucket =
      options?.bucket ||
      process.env.AWS_S3_BUCKET ||
      process.env.STORAGE_BUCKET ||
      "crewn-uploads";
    this.region =
      options?.region ||
      process.env.AWS_REGION ||
      process.env.STORAGE_REGION ||
      "us-east-1";
    this.endpoint =
      options?.endpoint ||
      process.env.AWS_ENDPOINT ||
      process.env.STORAGE_ENDPOINT;

    const accessKeyId =
      options?.accessKeyId ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey =
      options?.secretAccessKey ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.STORAGE_SECRET_ACCESS_KEY;

    // Production security check: warn or require S3 credentials if using S3
    if (process.env.NODE_ENV === "production" && (!accessKeyId || !secretAccessKey)) {
      throw new Error(
        "AWS_ACCESS_KEY_ID (or STORAGE_ACCESS_KEY_ID) and AWS_SECRET_ACCESS_KEY must be configured for S3 storage in production."
      );
    }

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: this.region,
    };

    if (this.endpoint) {
      clientConfig.endpoint = this.endpoint;
      clientConfig.forcePathStyle = true; // Required for MinIO and custom S3 endpoints
    }

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  public getClient(): S3Client {
    return this.client;
  }

  public getBucket(): string {
    return this.bucket;
  }

  public getRegion(): string {
    return this.region;
  }

  public getEndpoint(): string | undefined {
    return this.endpoint;
  }

  async createUploadUrl(
    key: string,
    mimeType: string,
    _maxSizeBytes?: number
  ): Promise<{ uploadUrl: string; storageKey: string; expiresAt: Date }> {
    void _maxSizeBytes;
    const cleanKey = key.replace(/^\/+/, "");
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: mimeType || "application/octet-stream",
    });

    const expiresInSeconds = 900; // 15 mins
    const uploadUrl = await getS3PresignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      storageKey: cleanKey,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async getFileUrl(key: string, isPublic = true): Promise<string> {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }
    const cleanKey = key.replace(/^\/+/, "");
    if (!isPublic) {
      const signed = await this.getSignedUrl(cleanKey);
      return signed.url;
    }
    const cdnUrl = process.env.STORAGE_CDN_URL;
    if (cdnUrl) {
      return `${cdnUrl.replace(/\/$/, "")}/${cleanKey}`;
    }
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${cleanKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${cleanKey}`;
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = 900
  ): Promise<{ url: string; expiresAt: Date }> {
    const cleanKey = key.replace(/^\/+/, "");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    const rawUrl = await getS3PresignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    // Provide HMAC verification parameters for dual verification compatibility
    const hmacSigned = generateSignedUrl(path.basename(cleanKey), expiresInSeconds);
    const searchParams = new URLSearchParams(hmacSigned.url.split("?")[1] || "");
    const token = searchParams.get("token");
    const expires = searchParams.get("expires");

    const separator = rawUrl.includes("?") ? "&" : "?";
    const url = `${rawUrl}${separator}token=${token}&expires=${expires}`;

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const cleanKey = path.basename(key);
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      await this.client.send(command);
      return true;
    } catch (err) {
      console.error("[S3StorageProvider] Failed to delete S3 file:", err);
      return false;
    }
  }

  async getObjectMetadata(
    key: string
  ): Promise<{ size: number; mimeType: string; lastModified: Date } | null> {
    try {
      const cleanKey = path.basename(key);
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      const response = await this.client.send(command);
      return {
        size: response.ContentLength ?? 0,
        mimeType: response.ContentType ?? "application/octet-stream",
        lastModified: response.LastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }

  async saveBuffer(key: string, buffer: Buffer, mimeType = "application/octet-stream"): Promise<string> {
    const cleanKey = path.basename(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: mimeType,
    });
    await this.client.send(command);
    return this.getFileUrl(cleanKey, false);
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

export function resetStorageProvider(): void {
  activeStorageProvider = null;
}
