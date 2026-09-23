import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.enum(["BUSINESS", "FREELANCER"], {
    error: "Role must be either BUSINESS or FREELANCER",
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset token"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, "Invalid verification token"),
});

export const businessOnboardingSchema = z.object({
  name: z.string().min(2, "Business name is required").max(120),
  legalName: z.string().max(160).optional(),
  taxId: z.string().max(50).optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
  industry: z.string().min(2, "Industry is required").max(100),
  companySize: z.string().min(1, "Company size is required"),
});

export const freelancerOnboardingSchema = z.object({
  headline: z.string().min(3, "Professional title is required").max(120),
  bio: z.string().min(20, "Bio must be at least 20 characters").max(2000),
  location: z.string().max(100).optional(),
  hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
  yearsExperience: z.number().int().min(0, "Years of experience cannot be negative").default(1),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  instagramUrl: z.string().url("Invalid Instagram URL").optional().or(z.literal("")),
  behanceUrl: z.string().url("Invalid Behance URL").optional().or(z.literal("")),
  vimeoUrl: z.string().url("Invalid Vimeo URL").optional().or(z.literal("")),
  availabilityStatus: z.enum(["AVAILABLE", "PARTIALLY_AVAILABLE", "BUSY", "UNAVAILABLE"]).default("AVAILABLE"),
  hoursPerWeek: z.number().int().min(1).max(168).default(40),
  skills: z.array(z.string().min(1)).min(1, "Please select at least one skill"),
  services: z
    .array(
      z.object({
        title: z.string().min(3, "Service title is required"),
        description: z.string().min(10, "Service description must be at least 10 characters"),
        basePrice: z.number().positive("Base price must be positive"),
        deliveryDays: z.number().int().positive().default(7),
        revisionLimit: z.number().int().min(0).default(2),
      })
    )
    .optional(),
  portfolioItems: z
    .array(
      z.object({
        title: z.string().min(2, "Portfolio title is required"),
        description: z.string().optional(),
        mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).default("IMAGE"),
        externalUrl: z.string().url("Invalid external link").optional().or(z.literal("")),
      })
    )
    .optional(),
});
