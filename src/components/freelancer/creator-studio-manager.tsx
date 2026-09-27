"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface CreatorStudioProps {
  initialProfile: {
    id: string;
    userId: string;
    name: string | null;
    avatarUrl: string | null;
    headline: string;
    bio: string;
    location: string | null;
    yearsExperience: number;
    hourlyRate: number | null;
    publicSlug: string | null;
    marketplaceVisible: boolean;
    isVerified: boolean;
    website: string | null;
    instagramUrl: string | null;
    behanceUrl: string | null;
    vimeoUrl: string | null;
    availability: {
      status: string;
      hoursPerWeek: number;
      nextAvailableDate: string | null;
    } | null;
    skills: Array<{ id: string; name: string }>;
    services: Array<{
      id: string;
      title: string;
      description: string;
      category: string | null;
      basePrice: number;
      pricingType: string;
      currency: string;
      deliveryDays: number;
      revisionLimit: number;
      isActive: boolean;
    }>;
    portfolioItems: Array<{
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      mediaType: string;
      externalUrl: string | null;
      coverFileId: string | null;
      coverFile?: { storageKey: string; fileName: string } | null;
      published: boolean;
      displayOrder: number;
    }>;
  };
}

export function CreatorStudioManager({ initialProfile }: CreatorStudioProps) {
  const router = useRouter();
  const [profile, setProfile] = React.useState(initialProfile);

  // Visibility toggle
  const [togglingVisibility, setTogglingVisibility] = React.useState(false);

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = React.useState(false);
  const [editHeadline, setEditHeadline] = React.useState(profile.headline);
  const [editBio, setEditBio] = React.useState(profile.bio);
  const [editLocation, setEditLocation] = React.useState(profile.location || "");
  const [editHourlyRate, setEditHourlyRate] = React.useState(
    profile.hourlyRate ? String(profile.hourlyRate) : ""
  );
  const [editPublicSlug, setEditPublicSlug] = React.useState(
    profile.publicSlug || ""
  );
  const [editSkillsStr, setEditSkillsStr] = React.useState(
    profile.skills.map((s) => s.name).join(", ")
  );
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Availability Modal
  const [editAvailabilityOpen, setEditAvailabilityOpen] = React.useState(false);
  const [availStatus, setAvailStatus] = React.useState(
    profile.availability?.status || "AVAILABLE"
  );
  const [availHours, setAvailHours] = React.useState(
    String(profile.availability?.hoursPerWeek || 40)
  );
  const [savingAvailability, setSavingAvailability] = React.useState(false);

  // Service Modal (Create or Edit)
  const [serviceModalOpen, setServiceModalOpen] = React.useState(false);
  const [editingServiceId, setEditingServiceId] = React.useState<string | null>(
    null
  );
  const [serviceTitle, setServiceTitle] = React.useState("");
  const [serviceDesc, setServiceDesc] = React.useState("");
  const [servicePrice, setServicePrice] = React.useState("");
  const [servicePricingType, setServicePricingType] = React.useState("FIXED");
  const [serviceDeliveryDays, setServiceDeliveryDays] = React.useState("3");
  const [serviceRevisions, setServiceRevisions] = React.useState("2");
  const [serviceCategory, setServiceCategory] = React.useState("");
  const [savingService, setSavingService] = React.useState(false);

  // Portfolio Modal (Create)
  const [portfolioModalOpen, setPortfolioModalOpen] = React.useState(false);
  const [portfolioTitle, setPortfolioTitle] = React.useState("");
  const [portfolioDesc, setPortfolioDesc] = React.useState("");
  const [portfolioCategory, setPortfolioCategory] = React.useState("");
  const [portfolioMediaType, setPortfolioMediaType] = React.useState("IMAGE");
  const [portfolioExternalUrl, setPortfolioExternalUrl] = React.useState("");
  const [portfolioFile, setPortfolioFile] = React.useState<File | null>(null);
  const [savingPortfolio, setSavingPortfolio] = React.useState(false);

  // Profile completion calculation based on real criteria
  const completionCriteria = React.useMemo(() => {
    return [
      { name: "Professional Headline", met: Boolean(profile.headline?.trim()) },
      { name: "Detailed Bio (50+ chars)", met: Boolean(profile.bio?.length >= 50) },
      { name: "Custom Username Slug", met: Boolean(profile.publicSlug) },
      { name: "Location specified", met: Boolean(profile.location) },
      { name: "Hourly Rate set", met: Boolean(profile.hourlyRate && profile.hourlyRate > 0) },
      { name: "At least 3 Skills", met: profile.skills.length >= 3 },
      { name: "At least 1 Service Package", met: profile.services.length >= 1 },
      { name: "At least 1 Portfolio Item", met: profile.portfolioItems.length >= 1 },
    ];
  }, [profile]);

  const completedCount = completionCriteria.filter((c) => c.met).length;
  const completionPercentage = Math.round(
    (completedCount / completionCriteria.length) * 100
  );

  // 1. Toggle Marketplace Visibility
  const handleToggleVisibility = async () => {
    try {
      setTogglingVisibility(true);
      const newVisibility = !profile.marketplaceVisible;

      const res = await fetch("/api/freelancer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceVisible: newVisibility }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update visibility");
      }

      setProfile((prev) => ({ ...prev, marketplaceVisible: newVisibility }));
      toast.success(
        newVisibility
          ? "Profile Visible in Marketplace"
          : "Profile Hidden from Marketplace",
        newVisibility
          ? "Clients can now discover your services and send direct inquiries."
          : "Your profile will not appear in marketplace search results."
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Update Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setTogglingVisibility(false);
    }
  };

  // 2. Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const skillsArray = editSkillsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/freelancer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: editHeadline,
          bio: editBio,
          location: editLocation,
          hourlyRate: editHourlyRate ? Number(editHourlyRate) : null,
          publicSlug: editPublicSlug,
          skills: skillsArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save profile");
      }

      setProfile((prev) => ({
        ...prev,
        headline: editHeadline,
        bio: editBio,
        location: editLocation,
        hourlyRate: editHourlyRate ? Number(editHourlyRate) : null,
        publicSlug: editPublicSlug || null,
        skills: skillsArray.map((s, idx) => ({ id: `temp-${idx}`, name: s })),
      }));

      toast.success(
        "Profile Updated",
        "Your studio profile changes have been saved."
      );
      setEditProfileOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Save Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // 3. Save Availability
  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAvailability(true);
      const res = await fetch("/api/freelancer/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: availStatus,
          hoursPerWeek: Number(availHours) || 40,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update availability");
      }

      setProfile((prev) => ({
        ...prev,
        availability: {
          status: availStatus,
          hoursPerWeek: Number(availHours) || 40,
          nextAvailableDate: null,
        },
      }));

      toast.success(
        "Availability Updated",
        `Status set to ${availStatus.replace("_", " ")}.`
      );
      setEditAvailabilityOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Update Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  // 4. Save Service (Create or Update)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingService(true);
      const payload = {
        title: serviceTitle,
        description: serviceDesc,
        basePrice: Number(servicePrice),
        pricingType: servicePricingType,
        deliveryDays: Number(serviceDeliveryDays) || 3,
        revisionLimit: Number(serviceRevisions) || 2,
        category: serviceCategory,
      };

      if (editingServiceId) {
        const res = await fetch(`/api/freelancer/services/${editingServiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update service");
        const data = await res.json();
        setProfile((prev) => ({
          ...prev,
          services: prev.services.map((s) =>
            s.id === editingServiceId ? data.service : s
          ),
        }));
        toast.success("Service Updated", "Package details saved.");
      } else {
        const res = await fetch("/api/freelancer/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create service");
        const data = await res.json();
        setProfile((prev) => ({
          ...prev,
          services: [data.service, ...prev.services],
        }));
        toast.success(
          "Service Package Created",
          "Your new package is live."
        );
      }

      setServiceModalOpen(false);
      setEditingServiceId(null);
      setServiceTitle("");
      setServiceDesc("");
      setServicePrice("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Service Save Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSavingService(false);
    }
  };

  // Delete Service
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service package?")) return;
    try {
      const res = await fetch(`/api/freelancer/services/${serviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete service");
      setProfile((prev) => ({
        ...prev,
        services: prev.services.filter((s) => s.id !== serviceId),
      }));
      toast.success("Service Deleted", "Package has been removed.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Delete Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  };

  // 5. Create Portfolio Item (with file upload)
  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPortfolio(true);

      let coverFileId: string | undefined = undefined;

      // Upload file if selected
      if (portfolioFile) {
        const formData = new FormData();
        formData.append("file", portfolioFile);
        formData.append("resourceType", "PORTFOLIO_ITEM");
        if (profile?.id) {
          formData.append("resourceId", profile.id);
        }
        formData.append("isPublic", "true");

        const uploadRes = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json();
          throw new Error(uploadErr.error || "File upload failed");
        }

        const uploadData = await uploadRes.json();
        coverFileId = uploadData.file.id;
      }

      const res = await fetch("/api/freelancer/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: portfolioTitle,
          description: portfolioDesc,
          category: portfolioCategory,
          mediaType: portfolioMediaType,
          externalUrl: portfolioExternalUrl,
          coverFileId,
          published: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create portfolio item");
      }

      const data = await res.json();
      setProfile((prev) => ({
        ...prev,
        portfolioItems: [...prev.portfolioItems, data.item],
      }));

      toast.success(
        "Portfolio Item Published",
        "Your work is now showcasing on your profile."
      );

      setPortfolioModalOpen(false);
      setPortfolioTitle("");
      setPortfolioDesc("");
      setPortfolioCategory("");
      setPortfolioFile(null);
      setPortfolioExternalUrl("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Publish Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSavingPortfolio(false);
    }
  };

  // Toggle Portfolio Publish State
  const handleTogglePortfolioPublished = async (
    itemId: string,
    currentStatus: boolean
  ) => {
    try {
      const res = await fetch(`/api/freelancer/portfolio/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setProfile((prev) => ({
        ...prev,
        portfolioItems: prev.portfolioItems.map((p) =>
          p.id === itemId ? { ...p, published: !currentStatus } : p
        ),
      }));
      toast.success(
        !currentStatus ? "Item Published" : "Item Hidden to Drafts",
        "Portfolio visibility updated."
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Update Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  };

  // Delete Portfolio Item
  const handleDeletePortfolio = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this portfolio item?")) return;
    try {
      const res = await fetch(`/api/freelancer/portfolio/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      setProfile((prev) => ({
        ...prev,
        portfolioItems: prev.portfolioItems.filter((p) => p.id !== itemId),
      }));
      toast.success("Portfolio Item Removed", "Item deleted from portfolio.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Delete Failed",
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  };

  const publicUrl = `/creators/${profile.publicSlug || profile.id}`;

  return (
    <div className="space-y-8">
      {/* Studio Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between rounded-2xl border border-border bg-card p-6 gap-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-border shadow-sm">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={profile.name || "User"} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl uppercase">
              {(profile.name || "CR")[0]}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {profile.name}
              </h1>
              {profile.isVerified && (
                <Badge variant="pastel-green" size="sm" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Creator
                </Badge>
              )}
              {profile.publicSlug && (
                <span className="text-xs font-mono text-muted-foreground">
                  @{profile.publicSlug}
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-foreground">
              {profile.headline || "Creative Specialist"}
            </p>

            <p className="text-xs text-muted-foreground flex items-center gap-3">
              <span>{profile.location || "Remote Studio"}</span>
              {profile.hourlyRate && (
                <span>₹{profile.hourlyRate.toLocaleString()} / hr</span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Actions (Preview & Edit) */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={publicUrl} target="_blank">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              View Public Profile
            </Button>
          </Link>

          <Button
            variant="default"
            size="sm"
            onClick={() => setEditProfileOpen(true)}
            className="gap-1 text-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Profile Completion & Marketplace Visibility Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real Profile Completion Indicator */}
        <Card className="border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Profile Completeness
              </p>
              <h3 className="text-2xl font-bold text-foreground">
                {completionPercentage}%
              </h3>
            </div>
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center font-bold text-xs text-primary">
              {completedCount}/{completionCriteria.length}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Real Checklist */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            {completionCriteria.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-1.5 text-muted-foreground"
              >
                {c.met ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                )}
                <span className={c.met ? "text-foreground font-medium" : ""}>
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Marketplace Visibility & Availability Control */}
        <Card className="border border-border bg-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Marketplace Discovery Status
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      profile.marketplaceVisible
                        ? "bg-emerald-500"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <h4 className="text-base font-semibold text-foreground">
                    {profile.marketplaceVisible
                      ? "Publicly Discoverable"
                      : "Hidden from Directory"}
                  </h4>
                </div>
              </div>

              <Button
                variant={profile.marketplaceVisible ? "outline" : "default"}
                size="sm"
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className="gap-1.5 text-xs"
              >
                {togglingVisibility ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : profile.marketplaceVisible ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide Profile
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Make Public
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              When public, your profile appears in search results and category
              filters for verified business clients looking to hire talent.
            </p>
          </div>

          {/* Availability Status Bar */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-foreground font-medium">
                {profile.availability?.status.replace("_", " ") || "AVAILABLE"}
              </span>
              <span className="text-muted-foreground">
                ({profile.availability?.hoursPerWeek || 40}h / week)
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditAvailabilityOpen(true)}
              className="text-xs h-7"
            >
              Update Availability
            </Button>
          </div>
        </Card>
      </div>

      {/* Services Packages Management */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Commissionable Services
            </h2>
            <p className="text-xs text-muted-foreground">
              Define packages that clients can select and book for projects
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setEditingServiceId(null);
              setServiceTitle("");
              setServiceDesc("");
              setServicePrice("");
              setServiceCategory("");
              setServiceModalOpen(true);
            }}
            className="gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Service Package
          </Button>
        </div>

        {profile.services.length === 0 ? (
          <Card className="p-8 text-center border-border bg-card">
            <p className="text-xs text-muted-foreground">
              No services packages created yet. Add standard offerings like &ldquo;Short-Form Video Editing&rdquo; or &ldquo;Product Photography&rdquo;.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.services.map((srv) => (
              <Card
                key={srv.id}
                className="p-5 border border-border bg-card flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-foreground">
                      {srv.title}
                    </h4>
                    {srv.category && (
                      <Badge variant="outline" size="sm" className="text-[10px]">
                        {srv.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {srv.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    ⏱ {srv.deliveryDays}d delivery • {srv.revisionLimit} revisions
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <p className="font-bold text-sm font-mono text-foreground">
                    ₹{srv.basePrice.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingServiceId(srv.id);
                        setServiceTitle(srv.title);
                        setServiceDesc(srv.description);
                        setServicePrice(String(srv.basePrice));
                        setServicePricingType(srv.pricingType);
                        setServiceDeliveryDays(String(srv.deliveryDays));
                        setServiceRevisions(String(srv.revisionLimit));
                        setServiceCategory(srv.category || "");
                        setServiceModalOpen(true);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteService(srv.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Portfolio Showcase Management */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Portfolio Showcase
            </h2>
            <p className="text-xs text-muted-foreground">
              High-resolution proof of craft visible on your public creator page
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => setPortfolioModalOpen(true)}
            className="gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Portfolio Item
          </Button>
        </div>

        {profile.portfolioItems.length === 0 ? (
          <Card className="p-8 text-center border-border bg-card">
            <p className="text-xs text-muted-foreground">
              No portfolio items added yet. Showcase your best campaigns, films, or designs.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profile.portfolioItems.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden border border-border bg-card flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video bg-muted/60 flex items-center justify-center overflow-hidden">
                    {item.coverFile?.storageKey ? (
                      <img
                        src={`/api/files/${item.coverFile.storageKey}`}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground uppercase font-mono">
                        {item.mediaType}
                      </span>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={item.published ? "pastel-green" : "secondary"}
                        size="sm"
                        className="text-[10px]"
                      >
                        {item.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-1">
                    <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-border flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleTogglePortfolioPublished(item.id, item.published)
                    }
                    className="text-xs h-7"
                  >
                    {item.published ? "Unpublish" : "Publish"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePortfolio(item.id)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Edit Profile Modal */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Creator Studio Profile</DialogTitle>
              <DialogDescription>
                Update your professional credentials, public username, and skills.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Public Username / Slug (/creators/[slug])
                </label>
                <Input
                  value={editPublicSlug}
                  onChange={(e) => setEditPublicSlug(e.target.value)}
                  placeholder="e.g. john-doe"
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Letters, numbers, and hyphens only.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Professional Headline
                </label>
                <Input
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="e.g. Commercial Cinematographer & Colorist"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Biography
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  required
                  placeholder="Describe your creative background, notable clients, and technical approach..."
                  className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Location
                  </label>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="City, Country"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Hourly Rate (₹)
                  </label>
                  <Input
                    type="number"
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(e.target.value)}
                    placeholder="e.g. 5000"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Skills (comma separated)
                </label>
                <Input
                  value={editSkillsStr}
                  onChange={(e) => setEditSkillsStr(e.target.value)}
                  placeholder="Premiere Pro, DaVinci Resolve, Sony FX3, Commercial Directing"
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditProfileOpen(false)}
                disabled={savingProfile}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={savingProfile}>
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Availability Modal */}
      <Dialog
        open={editAvailabilityOpen}
        onOpenChange={setEditAvailabilityOpen}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveAvailability} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Update Availability & Capacity</DialogTitle>
              <DialogDescription>
                Configure your current working bandwidth for incoming projects.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Status
                </label>
                <select
                  value={availStatus}
                  onChange={(e) => setAvailStatus(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="AVAILABLE">Available for Work</option>
                  <option value="PARTIALLY_AVAILABLE">Partially Available</option>
                  <option value="BUSY">Busy / Booking in Advance</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Weekly Capacity (Hours)
                </label>
                <Input
                  type="number"
                  value={availHours}
                  onChange={(e) => setAvailHours(e.target.value)}
                  min={0}
                  max={168}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditAvailabilityOpen(false)}
                disabled={savingAvailability}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={savingAvailability}
              >
                {savingAvailability ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update Availability"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Service Modal */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveService} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingServiceId ? "Edit Service Package" : "Create Service Package"}
              </DialogTitle>
              <DialogDescription>
                Package your creative deliverables with transparent pricing and turnaround times.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Service Title
                </label>
                <Input
                  value={serviceTitle}
                  onChange={(e) => setServiceTitle(e.target.value)}
                  placeholder="e.g. 60-second Commercial Color Grade"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Category
                </label>
                <Input
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  placeholder="e.g. Color Grading, Video Editing, 3D Design"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Description & Deliverables Included
                </label>
                <textarea
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                  rows={3}
                  required
                  placeholder="Include what is covered, export formats, raw footage handling..."
                  className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Base Price (₹)
                  </label>
                  <Input
                    type="number"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="e.g. 15000"
                    required
                    min={0}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Pricing Type
                  </label>
                  <select
                    value={servicePricingType}
                    onChange={(e) => setServicePricingType(e.target.value)}
                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="FIXED">Fixed Price</option>
                    <option value="STARTING_FROM">Starting From</option>
                    <option value="HOURLY">Hourly Rate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Delivery Time (Days)
                  </label>
                  <Input
                    type="number"
                    value={serviceDeliveryDays}
                    onChange={(e) => setServiceDeliveryDays(e.target.value)}
                    min={1}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Revisions Included
                  </label>
                  <Input
                    type="number"
                    value={serviceRevisions}
                    onChange={(e) => setServiceRevisions(e.target.value)}
                    min={0}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setServiceModalOpen(false)}
                disabled={savingService}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={savingService}>
                {savingService ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Package"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Portfolio Modal */}
      <Dialog
        open={portfolioModalOpen}
        onOpenChange={setPortfolioModalOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSavePortfolio} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Publish Portfolio Item</DialogTitle>
              <DialogDescription>
                Showcase commercial deliverables, campaign photography, or video works.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Title
                </label>
                <Input
                  value={portfolioTitle}
                  onChange={(e) => setPortfolioTitle(e.target.value)}
                  placeholder="e.g. Nike Winter Commercial Grade"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Cover Image / Media Asset
                </label>
                <Input
                  type="file"
                  accept="image/*,video/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPortfolioFile(f);
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Project Description
                </label>
                <textarea
                  value={portfolioDesc}
                  onChange={(e) => setPortfolioDesc(e.target.value)}
                  rows={3}
                  placeholder="Role on project, cameras or software used, client objective..."
                  className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Media Type
                  </label>
                  <select
                    value={portfolioMediaType}
                    onChange={(e) => setPortfolioMediaType(e.target.value)}
                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="IMAGE">Image / Stills</option>
                    <option value="VIDEO">Video Production</option>
                    <option value="DOCUMENT">Document / PDF Deck</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Category Tag
                  </label>
                  <Input
                    value={portfolioCategory}
                    onChange={(e) => setPortfolioCategory(e.target.value)}
                    placeholder="e.g. Commercial"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  External URL / Live Link
                </label>
                <Input
                  value={portfolioExternalUrl}
                  onChange={(e) => setPortfolioExternalUrl(e.target.value)}
                  placeholder="https://vimeo.com/... or https://behance.net/..."
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPortfolioModalOpen(false)}
                disabled={savingPortfolio}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={savingPortfolio}
              >
                {savingPortfolio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Publish Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
