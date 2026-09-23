// ==============================================================================
// CREWN - Core Domain TypeScript Definitions
// Two-Sided Marketplace & Creative Collaboration Platform
// ==============================================================================

export type UserRole = "BUSINESS" | "FREELANCER" | "ADMIN";

export type BusinessRole =
  | "OWNER"
  | "MANAGER"
  | "PROJECT_MANAGER"
  | "FINANCE"
  | "MEMBER";

export type TeamRole = "LEADER" | "CORE_MEMBER" | "COLLABORATOR";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export type ProjectStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectMemberRole =
  | "OWNER"
  | "MANAGER"
  | "FREELANCER"
  | "TEAM_MEMBER";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type DeliverableStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "REVISION_REQUESTED"
  | "APPROVED";

export type ReviewDecision = "APPROVED" | "REVISION_REQUESTED";

export type MilestoneStatus =
  | "PENDING"
  | "ACTIVE"
  | "SUBMITTED"
  | "APPROVED"
  | "PAID";

export type MilestonePaymentStatus =
  | "PENDING"
  | "HELD_IN_ESCROW"
  | "RELEASED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID";

export type AvailabilityStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "BUSY"
  | "UNAVAILABLE";

export type MediaType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export type ConversationType = "DIRECT" | "PROJECT" | "TEAM";

export type NotificationType =
  | "MILESTONE"
  | "DELIVERABLE"
  | "TASK"
  | "PAYMENT"
  | "MESSAGE"
  | "SYSTEM";

export type ContractStatus = "DRAFT" | "SENT" | "EXECUTED" | "TERMINATED";

export type DisputeStatus =
  | "OPEN"
  | "UNDER_MEDIATION"
  | "RESOLVED"
  | "CANCELLED";

// ------------------------------------------------------------------------------
// DOMAIN ENTITIES
// ------------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone?: string | null;
  role: UserRole;
  isVerified: boolean;
  onboarded: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt?: Date | null;
  lastReauthenticatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationToken {
  id: string;
  identifier: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isVerified: boolean;
  onboarded: boolean;
  businessMemberships?: Array<{
    id: string;
    businessId: string;
    role: BusinessRole;
    business: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
    };
  }>;
  freelancerProfile?: {
    id: string;
    headline: string;
    isVerified: boolean;
    hourlyRate: number | null;
  } | null;
}

export interface SessionJWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  onboarded: boolean;
  sessionId?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: "BUSINESS" | "FREELANCER";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface BusinessOnboardingPayload {
  name: string;
  legalName?: string;
  taxId?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  companySize?: string;
}

export interface FreelancerOnboardingPayload {
  headline: string;
  bio: string;
  location?: string;
  hourlyRate?: number;
  yearsExperience: number;
  website?: string;
  instagramUrl?: string;
  behanceUrl?: string;
  vimeoUrl?: string;
  availabilityStatus?: AvailabilityStatus;
  hoursPerWeek?: number;
  skills: string[];
  services?: Array<{
    title: string;
    description: string;
    basePrice: number;
    deliveryDays: number;
    revisionLimit: number;
  }>;
  portfolioItems?: Array<{
    title: string;
    description?: string;
    mediaType?: MediaType;
    externalUrl?: string;
  }>;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  taxId?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  companySize?: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessMember {
  id: string;
  businessId: string;
  userId: string;
  role: BusinessRole;
  joinedAt: Date;
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  headline: string;
  bio: string;
  location?: string | null;
  hourlyRate?: number | null;
  yearsExperience: number;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  website?: string | null;
  instagramUrl?: string | null;
  behanceUrl?: string | null;
  vimeoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Availability {
  id: string;
  freelancerProfileId: string;
  status: AvailabilityStatus;
  hoursPerWeek: number;
  nextAvailableDate?: Date | null;
  updatedAt: Date;
}

export interface Service {
  id: string;
  freelancerProfileId: string;
  title: string;
  description: string;
  basePrice: number;
  currency: string;
  deliveryDays: number;
  revisionLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioItem {
  id: string;
  freelancerProfileId: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  externalUrl?: string | null;
  coverFileId?: string | null;
  isFeatured: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
  leadFreelancerId: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  freelancerId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface Project {
  id: string;
  businessId: string;
  createdById: string;
  title: string;
  description: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  startDate?: Date | null;
  deadline?: Date | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  teamId?: string | null;
  role: ProjectMemberRole;
  joinedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  assignedToId?: string | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deliverable {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  title: string;
  description?: string | null;
  status: DeliverableStatus;
  currentVersionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliverableVersion {
  id: string;
  deliverableId: string;
  versionNumber: number;
  fileId: string;
  submittedById: string;
  changelog?: string | null;
  createdAt: Date;
}

export interface DeliverableReview {
  id: string;
  versionId: string;
  reviewerId: string;
  decision: ReviewDecision;
  feedbackText: string;
  createdAt: Date;
}

export interface FileMetadata {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  projectId?: string | null;
  taskId?: string | null;
  isPublic: boolean;
  createdAt: Date;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  amount: number;
  dueDate?: Date | null;
  status: MilestoneStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestonePayment {
  id: string;
  milestoneId: string;
  amount: number;
  currency: string;
  status: MilestonePaymentStatus;
  escrowHeldAt?: Date | null;
  releasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentTransaction {
  id: string;
  milestonePaymentId?: string | null;
  gatewayProvider: string;
  gatewayPaymentId?: string | null;
  gatewayOrderId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  businessId: string;
  recipientId: string;
  invoiceNumber: string;
  totalAmount: number;
  taxAmount: number;
  currency: string;
  status: InvoiceStatus;
  pdfFileKey?: string | null;
  dueDate?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  projectId: string;
  authorId: string;
  targetId: string;
  ratingOverall: number;
  ratingCommunication: number;
  ratingQuality: number;
  ratingTimeliness: number;
  comment: string;
  createdAt: Date;
}

export interface Contract {
  id: string;
  projectId: string;
  businessId: string;
  title: string;
  termsText: string;
  totalAmount: number;
  status: ContractStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dispute {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  initiatorId: string;
  respondentId: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  metadataJson?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}
