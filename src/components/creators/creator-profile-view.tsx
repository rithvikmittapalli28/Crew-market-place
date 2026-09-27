"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  MapPin,
  Clock,
  Globe,
  Camera,
  Bookmark,
  Mail,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Eye,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

interface CreatorProfileData {
  id: string;
  userId?: string;
  publicSlug: string | null;
  name: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  location: string | null;
  yearsExperience: number;
  hourlyRate: number | null;
  isVerified: boolean;
  marketplaceVisible: boolean;
  rating: number;
  reviewCount: number;
  website?: string | null;
  instagramUrl?: string | null;
  behanceUrl?: string | null;
  vimeoUrl?: string | null;
  skills: Array<{ id: string; name: string; slug: string }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  services: Array<{
    id: string;
    title: string;
    description: string;
    category?: string | null;
    basePrice: number;
    pricingType: string;
    currency: string;
    deliveryDays: number;
    revisionLimit: number;
    imageUrl?: string | null;
  }>;
  portfolio: Array<{
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    mediaType: string;
    externalUrl?: string | null;
    coverFileId?: string | null;
    coverFile?: {
      id: string;
      storageKey: string;
      fileName: string;
      mimeType: string;
    } | null;
    isFeatured: boolean;
    displayOrder: number;
  }>;
  availability: {
    status: string;
    hoursPerWeek: number;
    nextAvailableDate?: string | null;
  } | null;
  completedProjectCount: number;
  isSaved?: boolean;
  isOwner?: boolean;
}

export function CreatorProfileView({
  creator,
  currentUserId,
  currentUserRole,
}: {
  creator: CreatorProfileData;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}) {
  const router = useRouter();
  const [isSaved, setIsSaved] = React.useState(Boolean(creator.isSaved));
  const [savingAction, setSavingAction] = React.useState(false);

  // Inquiry modal state
  const [inquiryModalOpen, setInquiryModalOpen] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<{
    id: string;
    title: string;
    basePrice: number;
  } | null>(null);
  const [inquiryMessage, setInquiryMessage] = React.useState("");
  const [submittingInquiry, setSubmittingInquiry] = React.useState(false);

  // Portfolio detail modal state
  const [activePortfolioItem, setActivePortfolioItem] = React.useState<
    CreatorProfileData["portfolio"][0] | null
  >(null);

  const initials = creator.name
    ? creator.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CR";

  const isAvailable = creator.availability?.status === "AVAILABLE";
  const isPartial = creator.availability?.status === "PARTIALLY_AVAILABLE";

  const handleToggleSave = async () => {
    if (!currentUserId) {
      router.push(`/login?redirect=/creators/${creator.publicSlug || creator.id}`);
      return;
    }

    if (currentUserRole !== "BUSINESS" && currentUserRole !== "ADMIN") {
      toast.error(
        "Business Account Required",
        "Only business accounts can save creators to their roster."
      );
      return;
    }

    try {
      setSavingAction(true);
      if (isSaved) {
        const res = await fetch(`/api/business/saved-creators/${creator.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setIsSaved(false);
          toast.success(
            "Creator Removed",
            `${creator.name} was removed from your saved creators.`
          );
        }
      } else {
        const res = await fetch("/api/business/saved-creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freelancerId: creator.id }),
        });
        if (res.ok) {
          setIsSaved(true);
          toast.success(
            "Creator Saved",
            `${creator.name} is now saved in your workspace.`
          );
        }
      }
    } catch {
      toast.error(
        "Action Failed",
        "Unable to update saved creators. Please try again."
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenInquiry = (service?: {
    id: string;
    title: string;
    basePrice: number;
  }) => {
    if (!currentUserId) {
      router.push(`/login?redirect=/creators/${creator.publicSlug || creator.id}`);
      return;
    }

    if (creator.isOwner) {
      toast.error("Own Profile", "You cannot send an inquiry to yourself.");
      return;
    }

    setSelectedService(service || null);
    if (service) {
      setInquiryMessage(
        `Hi ${creator.name},\n\nI am interested in your service "${service.title}". Could we discuss scope, timelines, and deliverables?`
      );
    } else {
      setInquiryMessage(
        `Hi ${creator.name},\n\nI reviewed your portfolio and would like to collaborate on an upcoming project. Let me know when you are available to connect.`
      );
    }
    setInquiryModalOpen(true);
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryMessage.trim() || inquiryMessage.trim().length < 10) {
      toast.error(
        "Message Too Short",
        "Please include a brief message with at least 10 characters."
      );
      return;
    }

    try {
      setSubmittingInquiry(true);
      const res = await fetch("/api/creator-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerId: creator.id,
          serviceId: selectedService?.id || null,
          message: inquiryMessage.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send inquiry");
      }

      toast.success(
        "Inquiry Sent Successfully",
        `Your inquiry has been delivered to ${creator.name}.`
      );
      setInquiryModalOpen(false);
      setInquiryMessage("");
      setSelectedService(null);
    } catch (err: unknown) {
      toast.error(
        "Failed to Send Inquiry",
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmittingInquiry(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Private Profile Notice for Owner */}
      {creator.isOwner && !creator.marketplaceVisible && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-center text-xs sm:text-sm text-amber-500 flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" />
          <span>
            <strong>Preview Mode:</strong> Your profile is currently hidden from
            the public marketplace. Enable visibility in your Creator Studio.
          </span>
          <Link
            href="/freelancer"
            className="underline font-semibold ml-2 hover:text-amber-400"
          >
            Edit Studio
          </Link>
        </div>
      )}

      {/* Main Profile Header Banner */}
      <section className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Creator Identity */}
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-border shadow-md">
                {creator.avatarUrl && (
                  <AvatarImage src={creator.avatarUrl} alt={creator.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {creator.name}
                  </h1>
                  {creator.isVerified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified Creator
                    </span>
                  )}
                  {creator.publicSlug && (
                    <span className="text-xs text-muted-foreground font-mono">
                      @{creator.publicSlug}
                    </span>
                  )}
                </div>

                <p className="text-base text-muted-foreground font-medium max-w-2xl">
                  {creator.headline || "Creative Specialist"}
                </p>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  {creator.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {creator.location}
                    </span>
                  )}

                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {creator.yearsExperience} Years Experience
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isAvailable
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isPartial
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isAvailable
                          ? "bg-emerald-500"
                          : isPartial
                          ? "bg-amber-500"
                          : "bg-muted-foreground"
                      }`}
                    />
                    {isAvailable
                      ? `Available (${creator.availability?.hoursPerWeek || 40}h/wk)`
                      : isPartial
                      ? "Limited Availability"
                      : "Currently Booked"}
                  </span>

                  {creator.completedProjectCount > 0 && (
                    <span className="flex items-center gap-1 text-primary">
                      <Briefcase className="h-3.5 w-3.5" />
                      {creator.completedProjectCount} Completed Crewn Projects
                    </span>
                  )}
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3 pt-2 text-xs">
                  {creator.website && (
                    <a
                      href={
                        creator.website.startsWith("http")
                          ? creator.website
                          : `https://${creator.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </a>
                  )}
                  {creator.instagramUrl && (
                    <a
                      href={
                        creator.instagramUrl.startsWith("http")
                          ? creator.instagramUrl
                          : `https://instagram.com/${creator.instagramUrl.replace(/^@/, "")}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Instagram
                    </a>
                  )}
                  {creator.behanceUrl && (
                    <a
                      href={
                        creator.behanceUrl.startsWith("http")
                          ? creator.behanceUrl
                          : `https://behance.net/${creator.behanceUrl}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Behance
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions (Save & Inquire) */}
            <div className="flex flex-row md:flex-col items-center sm:items-end gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Standard Rate
                </p>
                <p className="text-xl font-bold text-foreground">
                  {creator.hourlyRate
                    ? `₹${creator.hourlyRate.toLocaleString()} / hr`
                    : "Flexible Pricing"}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {creator.isOwner ? (
                  <Link href="/freelancer" className="w-full sm:w-auto">
                    <Button variant="default" size="md" className="gap-2 w-full">
                      Edit in Creator Studio
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      variant={isSaved ? "secondary" : "outline"}
                      size="md"
                      onClick={handleToggleSave}
                      disabled={savingAction}
                      className="gap-2"
                      title={isSaved ? "Saved" : "Save Creator"}
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isSaved ? "fill-primary text-primary" : ""
                        }`}
                      />
                      <span className="hidden sm:inline">
                        {isSaved ? "Saved" : "Save"}
                      </span>
                    </Button>

                    {creator.userId && (
                      <Link href={`/messages?user=${creator.userId}`}>
                        <Button variant="default" size="md" className="gap-2 cursor-pointer">
                          <MessageSquare className="h-4 w-4" />
                          <span>Direct Message</span>
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant={creator.userId ? "outline" : "default"}
                      size="md"
                      onClick={() => handleOpenInquiry()}
                      className="gap-2 cursor-pointer"
                    >
                      <Mail className="h-4 w-4" />
                      Contact Creator
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Profile Body */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
        {/* Biography & Skills */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              About the Creator
            </h2>
            <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-card p-6 rounded-xl border border-border">
              {creator.bio || "No biography provided yet."}
            </div>
          </div>

          <div className="space-y-6">
            {/* Skills & Tools */}
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
              <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase tracking-wider text-xs">
                Skills & Disciplines
              </h3>
              <div className="flex flex-wrap gap-2">
                {creator.skills.length > 0 ? (
                  creator.skills.map((skill) => (
                    <Badge
                      key={skill.id}
                      variant="secondary"
                      size="md"
                      className="text-xs bg-muted/80"
                    >
                      {skill.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No skills listed.
                  </p>
                )}
              </div>
            </div>

            {/* Categories */}
            {creator.categories.length > 0 && (
              <div className="bg-card p-6 rounded-xl border border-border space-y-3">
                <h3 className="text-xs font-semibold tracking-tight text-foreground uppercase tracking-wider">
                  Specialized Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {creator.categories.map((c) => (
                    <Badge
                      key={c.id}
                      variant="outline"
                      size="md"
                      className="text-xs"
                    >
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Services Showcase */}
        {creator.services.length > 0 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Services & Packages
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Pre-defined creative packages ready for project engagement
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {creator.services.map((service) => (
                <Card
                  key={service.id}
                  className="flex flex-col justify-between p-6 border border-border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-base text-foreground">
                        {service.title}
                      </h3>
                      {service.category && (
                        <Badge variant="outline" size="sm" className="text-[10px]">
                          {service.category}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">
                      {service.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.deliveryDays}d delivery
                      </span>
                      <span>
                        {service.revisionLimit === 0
                          ? "No revisions"
                          : `${service.revisionLimit} revisions`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {service.pricingType === "HOURLY"
                          ? "Hourly"
                          : service.pricingType === "STARTING_FROM"
                          ? "Starts from"
                          : "Fixed Price"}
                      </p>
                      <p className="text-base font-bold text-foreground">
                        ₹{service.basePrice.toLocaleString()}
                      </p>
                    </div>

                    {!creator.isOwner && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleOpenInquiry({
                            id: service.id,
                            title: service.title,
                            basePrice: service.basePrice,
                          })
                        }
                        className="text-xs gap-1"
                      >
                        Request Service
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Portfolio Showcase */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Featured Portfolio
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Curated creative deliverables, productions, and projects
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {creator.portfolio.length} Published Item
              {creator.portfolio.length === 1 ? "" : "s"}
            </span>
          </div>

          {creator.portfolio.length === 0 ? (
            <Card className="p-8 text-center border-border bg-card">
              <p className="text-sm text-muted-foreground">
                No portfolio items have been published by this creator yet.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {creator.portfolio.map((item) => {
                const coverUrl = item.coverFile?.storageKey
                  ? `/api/files/${item.coverFile.storageKey}`
                  : null;

                return (
                  <Card
                    key={item.id}
                    onClick={() => setActivePortfolioItem(item)}
                    className="group cursor-pointer overflow-hidden border border-border bg-card hover:border-primary/50 transition-all hover:shadow-md"
                  >
                    {/* Media Thumbnail or Placeholder */}
                    <div className="relative aspect-video w-full bg-muted/60 overflow-hidden flex items-center justify-center">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={item.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4 text-center">
                          <Briefcase className="h-6 w-6" />
                          <span className="text-xs font-medium">
                            {item.mediaType}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="text-[10px] bg-background/80 backdrop-blur-sm"
                        >
                          {item.mediaType}
                        </Badge>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="p-4 space-y-1.5">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Structured Inquiry Modal */}
      <Dialog open={inquiryModalOpen} onOpenChange={setInquiryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmitInquiry} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Send Project Inquiry</DialogTitle>
              <DialogDescription>
                Initiate a direct conversation with {creator.name}. Include your
                project details and timeline expectations.
              </DialogDescription>
            </DialogHeader>

            {selectedService && (
              <div className="p-3 rounded-lg bg-muted/60 border border-border flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-foreground">
                    Selected Package: {selectedService.title}
                  </p>
                  <p className="text-muted-foreground">
                    Price: ₹{selectedService.basePrice.toLocaleString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedService(null)}
                  className="text-xs h-7"
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Inquiry Message
              </label>
              <textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Describe your project, deliverables needed, budget, and estimated timeline..."
                rows={5}
                required
                className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum 10 characters. Payments, contracts, and chat will connect
                subsequently upon creator acceptance.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInquiryModalOpen(false)}
                disabled={submittingInquiry}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={submittingInquiry}
                className="gap-2"
              >
                {submittingInquiry ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Inquiry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Portfolio Item Detail Modal */}
      <Dialog
        open={Boolean(activePortfolioItem)}
        onOpenChange={(open) => !open && setActivePortfolioItem(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {activePortfolioItem && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {activePortfolioItem.mediaType}
                  </Badge>
                  {activePortfolioItem.category && (
                    <Badge variant="secondary" size="sm">
                      {activePortfolioItem.category}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl mt-1">
                  {activePortfolioItem.title}
                </DialogTitle>
              </DialogHeader>

              {activePortfolioItem.coverFile?.storageKey && (
                <div className="rounded-lg overflow-hidden border border-border bg-black max-h-[360px] flex items-center justify-center">
                  <img
                    src={`/api/files/${activePortfolioItem.coverFile.storageKey}`}
                    alt={activePortfolioItem.title}
                    className="max-h-[360px] w-auto object-contain"
                  />
                </div>
              )}

              {activePortfolioItem.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activePortfolioItem.description}
                </p>
              )}

              {activePortfolioItem.externalUrl && (
                <div className="pt-2">
                  <a
                    href={
                      activePortfolioItem.externalUrl.startsWith("http")
                        ? activePortfolioItem.externalUrl
                        : `https://${activePortfolioItem.externalUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                  >
                    View External Project / Live Production
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
