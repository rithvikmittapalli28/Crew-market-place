import path from "path";
import crypto from "crypto";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase().trim() as AllowedMimeType);
}

export function getSafeExtensionForMime(mimeType: string): string {
  const mime = mimeType.toLowerCase().trim();
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "video/mp4":
      return ".mp4";
    case "video/quicktime":
      return ".mov";
    case "video/webm":
      return ".webm";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

/**
 * Sanitizes original filename for safe database storage.
 * Strips directory traversal (..), path separators, null bytes, and dangerous characters.
 * Never used directly as the disk or object storage path.
 */
export function sanitizeFileName(originalName: string): string {
  if (!originalName || typeof originalName !== "string") {
    return "unnamed_file";
  }

  // Extract base filename (removes directory paths)
  let clean = path.basename(originalName.trim());

  // Remove null bytes and control characters
  clean = clean.replace(/[\0\x00-\x1f\x7f-\x9f]/g, "");

  // Replace path separators and Windows forbidden characters with underscores
  clean = clean.replace(/[\\/:*?"<>|]/g, "_");

  // Remove any remaining directory traversal dots
  clean = clean.replace(/^\.+/, "");

  clean = clean.trim();
  if (!clean) return "unnamed_file";

  // Truncate to reasonable length (e.g. 200 chars preserving extension)
  if (clean.length > 200) {
    const ext = path.extname(clean);
    clean = clean.slice(0, 200 - ext.length) + ext;
  }

  return clean;
}

/**
 * Generates an unpredictable, cryptographically random server-side storage key.
 * Never includes user-provided filenames to prevent path traversal or collision attacks.
 */
export function generateStorageKey(
  userId: string,
  validatedMimeType: string,
  prefix = "upload"
): string {
  const ext = getSafeExtensionForMime(validatedMimeType);
  const randomHex = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const safeUserPrefix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "usr";
  return `${prefix}_${safeUserPrefix}_${timestamp}_${randomHex}${ext}`;
}

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType?: string;
  error?: string;
}

/**
 * Validates both declared Content-Type and actual uploaded file characteristics
 * via magic bytes / file signatures to prevent file-type spoofing attacks.
 */
export function validateFileSignature(
  buffer: Buffer,
  declaredMimeType: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Uploaded file is empty" };
  }

  const mime = declaredMimeType.toLowerCase().trim();

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (mime === "image/jpeg" || mime === "image/jpg") {
      return { isValid: true, detectedMimeType: "image/jpeg" };
    }
    return {
      isValid: false,
      detectedMimeType: "image/jpeg",
      error: `File signature indicates JPEG, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (mime === "image/png") {
      return { isValid: true, detectedMimeType: "image/png" };
    }
    return {
      isValid: false,
      detectedMimeType: "image/png",
      error: `File signature indicates PNG, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 3. GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    if (mime === "image/gif") {
      return { isValid: true, detectedMimeType: "image/gif" };
    }
    return {
      isValid: false,
      detectedMimeType: "image/gif",
      error: `File signature indicates GIF, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 4. WebP: RIFF....WEBP (Bytes 0-3: 52 49 46 46, Bytes 8-11: 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    if (mime === "image/webp") {
      return { isValid: true, detectedMimeType: "image/webp" };
    }
    return {
      isValid: false,
      detectedMimeType: "image/webp",
      error: `File signature indicates WebP, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 5. PDF: %PDF- (25 50 44 46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    if (mime === "application/pdf") {
      return { isValid: true, detectedMimeType: "application/pdf" };
    }
    return {
      isValid: false,
      detectedMimeType: "application/pdf",
      error: `File signature indicates PDF, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 6. MP4 / MOV: Bytes 4-7 are 'ftyp' (66 74 79 70)
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    if (mime === "video/mp4" || mime === "video/quicktime") {
      return { isValid: true, detectedMimeType: mime };
    }
    return {
      isValid: false,
      detectedMimeType: "video/mp4",
      error: `File signature indicates MP4/MOV, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 7. WebM: 1A 45 DF A3 (EBML)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    if (mime === "video/webm") {
      return { isValid: true, detectedMimeType: "video/webm" };
    }
    return {
      isValid: false,
      detectedMimeType: "video/webm",
      error: `File signature indicates WebM, but declared content-type was '${declaredMimeType}'`,
    };
  }

  // 8. SVG: XML text starting with <?xml or <svg, disallow script injection
  if (mime === "image/svg+xml") {
    const textPrefix = buffer.slice(0, 2048).toString("utf8").trim().toLowerCase();
    if (textPrefix.includes("<svg") || textPrefix.includes("<?xml")) {
      // Disallow dangerous script tags or event handlers in SVG
      if (
        textPrefix.includes("<script") ||
        textPrefix.includes("javascript:") ||
        textPrefix.includes("onload=") ||
        textPrefix.includes("onerror=")
      ) {
        return {
          isValid: false,
          error: "SVG file contains prohibited executable script or handler content",
        };
      }
      return { isValid: true, detectedMimeType: "image/svg+xml" };
    }
    return {
      isValid: false,
      error: "Declared SVG file does not have valid XML/SVG markup",
    };
  }

  // Fallback: If declared mime is not in allowed list or signature unknown
  return {
    isValid: false,
    error: `File content characteristics do not match declared content-type '${declaredMimeType}'`,
  };
}
