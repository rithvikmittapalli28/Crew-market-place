export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "business",
  "creators",
  "dashboard",
  "explore",
  "freelancer",
  "login",
  "logout",
  "marketplace",
  "messages",
  "onboarding",
  "projects",
  "register",
  "settings",
  "terms",
  "privacy",
  "about",
  "contact",
  "search",
  "uploads",
  "user",
  "verify-email",
  "forgot-password",
  "reset-password",
]);

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters long" };
  }
  if (slug.length > 50) {
    return { valid: false, error: "Username cannot exceed 50 characters" };
  }
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      error: "Username may only contain letters, numbers, hyphens, and underscores",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: `The username '${slug}' is reserved and cannot be used` };
  }
  return { valid: true };
}
