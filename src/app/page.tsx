import { Navbar } from "@/components/layout/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsSection } from "@/components/landing/stats-section";
import { CategoriesSection } from "@/components/landing/categories-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturedCreatorsSection } from "@/components/landing/featured-creators-section";
import { WorkspacePreviewSection } from "@/components/landing/workspace-preview-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200">
      {/* 1. Navigation */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Hero */}
        <HeroSection />

        {/* 3. Platform Statistics */}
        <StatsSection />

        {/* 4. Talent Categories */}
        <CategoriesSection />

        {/* 5. How It Works */}
        <HowItWorksSection />

        {/* 6. Featured Freelancer Preview */}
        <FeaturedCreatorsSection />

        {/* 7. Campaign Workspace Preview */}
        <WorkspacePreviewSection />

        {/* 8. Business & Freelancer Call to Action */}
        <CtaSection />
      </main>

      {/* 9. Footer */}
      <Footer />
    </div>
  );
}
