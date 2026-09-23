"use client";

import * as React from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/toast";
import { User, Lock, Sliders, Building2, Sparkles } from "lucide-react";
import type { AuthUser } from "@/types";

function AccountSettingsForm({
  user,
  refreshUser,
}: {
  user: AuthUser;
  refreshUser: () => Promise<void>;
}) {
  const [name, setName] = React.useState(user.name || "");
  const [phone, setPhone] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatarUrl || "");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          avatarUrl: avatarUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Failed to update profile", data.error);
      } else {
        await refreshUser();
        toast.success("Profile updated", "Your changes have been saved.");
      }
    } catch {
      toast.error("Error", "Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Your personal contact and identity information across Crewn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Account Email (Read-Only)"
              type="email"
              value={user.email}
              disabled
              className="opacity-70 bg-secondary/50 cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number (Optional)"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Avatar Image URL (Optional)"
              placeholder="https://example.com/photo.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="default" size="sm" type="submit" isLoading={isSaving}>
            Save Account Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function BusinessSettingsForm({
  user,
  refreshUser,
}: {
  user: AuthUser;
  refreshUser: () => Promise<void>;
}) {
  const initialBiz = user.businessMemberships?.[0]?.business;
  const [name, setName] = React.useState(initialBiz?.name || "");
  const [legalName, setLegalName] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [companySize, setCompanySize] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/business/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          legalName: legalName || undefined,
          taxId: taxId || undefined,
          industry: industry || undefined,
          companySize: companySize || undefined,
          website: website || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Failed to update business", data.error);
      } else {
        await refreshUser();
        toast.success("Business updated", "Organization details saved successfully.");
      }
    } catch {
      toast.error("Error", "Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Business Organization Settings</CardTitle>
          <CardDescription>
            Manage your legal business entity, tax ID, company size, and brand details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Brand / Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Legal Entity Name"
              placeholder="e.g. Lumina Studio Private Limited"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tax ID / GSTIN"
              placeholder="e.g. 27AABCU9603R1ZM"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
            />
            <Input
              label="Industry"
              placeholder="e.g. Fashion, Consumer Brands, SaaS"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company Size"
              placeholder="e.g. 1-10, 11-50"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
            />
            <Input
              label="Official Website"
              type="url"
              placeholder="https://lumina.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="default" size="sm" type="submit" isLoading={isSaving}>
            Save Organization
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function FreelancerSettingsForm({
  user,
  refreshUser,
}: {
  user: AuthUser;
  refreshUser: () => Promise<void>;
}) {
  const initialFl = user.freelancerProfile;
  const [headline, setHeadline] = React.useState(initialFl?.headline || "");
  const [bio, setBio] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [rate, setRate] = React.useState(initialFl?.hourlyRate ? String(initialFl.hourlyRate) : "");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/freelancer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          bio: bio || undefined,
          location: location || undefined,
          hourlyRate: rate ? Number(rate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Failed to update studio profile", data.error);
      } else {
        await refreshUser();
        toast.success("Studio profile updated", "Creator details saved successfully.");
      }
    } catch {
      toast.error("Error", "Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Creator Studio Profile</CardTitle>
          <CardDescription>
            Update your creative headline, location, and hourly rate displayed on the marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Professional Headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location Base"
              placeholder="e.g. Mumbai, India / Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              label="Standard Hourly Rate (₹ INR)"
              type="number"
              placeholder="2500"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Creative Bio</label>
            <textarea
              rows={3}
              placeholder="Describe your creative specialty..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="default" size="sm" type="submit" isLoading={isSaving}>
            Save Studio Profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SecuritySettingsForm({ user }: { user: AuthUser }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update password.");
      } else {
        setSuccessMessage("Your password has been successfully updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setErrorMessage("Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Password & Security</CardTitle>
          <CardDescription>
            Update your authentication credentials and manage session security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground">Email Verification Status</p>
            <p className="text-[11px] text-muted-foreground">
              {user?.isVerified
                ? "Your account email has been verified successfully. Full workspace access is enabled."
                : "Email verification is pending. Please verify your email to unlock all features."}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-xs rounded-xl bg-pastel-green-subtle text-emerald-600 dark:text-emerald-400 border border-pastel-green-border">
              {successMessage}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password (min 8 chars, 1 uppercase, 1 number)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="default" size="sm" type="submit" isLoading={isSaving}>
            Update Password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Settings & Workspace Preferences"
        subtitle="Manage your profile, organization details, security credentials, and workspace theme"
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              <span>Account</span>
            </TabsTrigger>
            {user?.role === "BUSINESS" && (
              <TabsTrigger value="organization" className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                <span>Organization</span>
              </TabsTrigger>
            )}
            {user?.role === "FREELANCER" && (
              <TabsTrigger value="studio" className="flex items-center gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-pastel-pink" />
                <span>Creator Studio</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="security" className="flex items-center gap-1.5 text-xs">
              <Lock className="h-3.5 w-3.5" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-1.5 text-xs">
              <Sliders className="h-3.5 w-3.5" />
              <span>Theme</span>
            </TabsTrigger>
          </TabsList>

          {/* Account Profile Tab */}
          <TabsContent value="profile" className="pt-4">
            {user ? (
              <AccountSettingsForm key={user.id} user={user} refreshUser={refreshUser} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-xs text-muted-foreground">
                  Loading account profile...
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Business Organization Tab */}
          {user?.role === "BUSINESS" && (
            <TabsContent value="organization" className="pt-4">
              <BusinessSettingsForm key={user.id} user={user} refreshUser={refreshUser} />
            </TabsContent>
          )}

          {/* Freelancer Studio Tab */}
          {user?.role === "FREELANCER" && (
            <TabsContent value="studio" className="pt-4">
              <FreelancerSettingsForm key={user.id} user={user} refreshUser={refreshUser} />
            </TabsContent>
          )}

          {/* Security Tab */}
          <TabsContent value="security" className="pt-4">
            {user ? (
              <SecuritySettingsForm key={user.id} user={user} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-xs text-muted-foreground">
                  Loading security settings...
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance & Theme</CardTitle>
                <CardDescription>
                  Switch between light and dark themes. Preferences are saved automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Active Interface Theme</p>
                    <p className="text-[11px] text-muted-foreground">
                      Near-black luxury editorial dark mode or warm paper off-white light mode.
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
