/**
 * ISOLATED LANDING PAGE VISUAL PREVIEW DATA
 * NOTE: This file is strictly for the public marketing landing page demonstration.
 * It is completely decoupled from database queries, business logic, auth, or payments.
 */

export interface PlatformStat {
  id: string;
  value: string;
  label: string;
  subtext: string;
  accentVariant: "pastel-pink" | "pastel-yellow" | "pastel-green" | "pastel-blue";
}

export interface TalentCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  disciplines: string[];
  accentColor: "pastel-pink" | "pastel-yellow" | "pastel-green" | "pastel-blue";
  iconName: string;
}

export interface FeaturedFreelancer {
  id: string;
  name: string;
  role: string;
  location: string;
  rating: number;
  reviewsCount: number;
  hourlyRate: string;
  verified: boolean;
  avatarUrl: string;
  tags: string[];
  pastClients: string[];
  accentColor: "pastel-pink" | "pastel-yellow" | "pastel-green" | "pastel-blue";
  featuredWorkTitle: string;
}

export interface WorkflowStep {
  step: string;
  title: string;
  description: string;
  deliverableBadge: string;
}

export const PLATFORM_STATS: PlatformStat[] = [
  {
    id: "creators",
    value: "14,800+",
    label: "Vetted Creative Minds",
    subtext: "Photographers, directors, editors, designers & writers",
    accentVariant: "pastel-pink",
  },
  {
    id: "delivery-rate",
    value: "98.6%",
    label: "On-Time Milestone Delivery",
    subtext: "Tracked across real production briefs and deliverables",
    accentVariant: "pastel-green",
  },
  {
    id: "satisfaction",
    value: "4.95 / 5",
    label: "Client & Creator Rating",
    subtext: "Verified reviews with transparent mutual accountability",
    accentVariant: "pastel-yellow",
  },
  {
    id: "payouts",
    value: "₹34+ Cr",
    label: "Paid Directly to Creators",
    subtext: "Transparent escrow milestones with zero hidden deductions",
    accentVariant: "pastel-blue",
  },
];

export const TALENT_CATEGORIES: TalentCategory[] = [
  {
    id: "cinematography",
    name: "Videography & Direction",
    slug: "videography",
    description: "Brand films, commercial spots, documentaries, and high-production drone cinematography.",
    disciplines: ["Commercial Films", "Drone Operators", "Music Videos", "Documentaries"],
    accentColor: "pastel-blue",
    iconName: "Video",
  },
  {
    id: "photography",
    name: "Commercial Photography",
    slug: "photography",
    description: "Lookbooks, product shoots, architectural captures, and editorial portraits.",
    disciplines: ["Product & E-Com", "Fashion Editorial", "Architecture", "Portraits"],
    accentColor: "pastel-pink",
    iconName: "Camera",
  },
  {
    id: "post-production",
    name: "Video Editing & Color Grading",
    slug: "editing",
    description: "DaVinci Resolve colorists, offline & online editors, short-form reel specialists.",
    disciplines: ["DaVinci Colorists", "Sound Design", "Social Reels & Shorts", "Long-form Cuts"],
    accentColor: "pastel-yellow",
    iconName: "Film",
  },
  {
    id: "motion-3d",
    name: "Motion & 3D Art",
    slug: "motion-3d",
    description: "Kinetic typography, CGI product visuals, Houdini simulations, and broadcast packaging.",
    disciplines: ["Cinema4D / Blender", "Houdini FX", "Kinetic Type", "Brand Motion Systems"],
    accentColor: "pastel-green",
    iconName: "Sparkles",
  },
  {
    id: "brand-identity",
    name: "Brand & Graphic Design",
    slug: "design",
    description: "Complete visual identities, design systems, typographic guidelines, and bespoke packaging.",
    disciplines: ["Brand Systems", "Packaging Design", "Editorial & Print", "Design Systems"],
    accentColor: "pastel-pink",
    iconName: "Palette",
  },
  {
    id: "editorial-copy",
    name: "Content & Copywriting",
    slug: "copywriting",
    description: "Brand narratives, commercial scripts, high-impact pitch decks, and technical essays.",
    disciplines: ["Commercial Scripts", "Brand Narratives", "Editorial Articles", "Pitch Decks"],
    accentColor: "pastel-blue",
    iconName: "PenTool",
  },
  {
    id: "social-strategy",
    name: "Social Media Strategy",
    slug: "social-media",
    description: "Campaign architectures, creator-led rollouts, community direction, and viral playbooks.",
    disciplines: ["Omnichannel Strategy", "Creator Collaborations", "Trend Forecasting", "Audience Growth"],
    accentColor: "pastel-yellow",
    iconName: "Share2",
  },
  {
    id: "seo-growth",
    name: "SEO & Growth Marketing",
    slug: "seo-growth",
    description: "Technical SEO audits, programmatic content pipelines, and creative performance marketing.",
    disciplines: ["Technical SEO", "Conversion Rate Audits", "Creative Ad Testing", "Programmatic SEO"],
    accentColor: "pastel-green",
    iconName: "TrendingUp",
  },
];

export const FEATURED_CREATORS: FeaturedFreelancer[] = [
  {
    id: "creator-1",
    name: "Aarav Sharma",
    role: "Commercial Cinematographer & Drone Pilot",
    location: "Mumbai & Bangalore, IN",
    rating: 4.98,
    reviewsCount: 42,
    hourlyRate: "₹4,500 / hr",
    verified: true,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
    tags: ["RED V-Raptor", "Drone Heavy-Lift", "Automotive Films", "DaVinci Resolve"],
    pastClients: ["Royal Enfield", "Tata Motors", "Nykaa Luxe"],
    accentColor: "pastel-blue",
    featuredWorkTitle: "Atmospheric Brand Film — Kinfolk Sanctuary",
  },
  {
    id: "creator-2",
    name: "Tara Sen",
    role: "Art Director & Brand Identity Designer",
    location: "New Delhi, IN",
    rating: 5.0,
    reviewsCount: 38,
    hourlyRate: "₹3,800 / hr",
    verified: true,
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80",
    tags: ["Visual Identity", "Sustainable Packaging", "Custom Typography", "Editorial"],
    pastClients: ["Forest Essentials", "Blue Tokai", "Nicobar"],
    accentColor: "pastel-pink",
    featuredWorkTitle: "Reimagined Sustainable Packaging for Artisan Brews",
  },
  {
    id: "creator-3",
    name: "Vikramaditya Rao",
    role: "3D Motion Designer & CGI Visualist",
    location: "Hyderabad, IN (Remote Global)",
    rating: 4.94,
    reviewsCount: 29,
    hourlyRate: "₹5,200 / hr",
    verified: true,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80",
    tags: ["Blender", "Cinema 4D", "Houdini Pyro", "Product CGI"],
    pastClients: ["OnePlus", "boAt Lifestyle", "Cult.fit"],
    accentColor: "pastel-green",
    featuredWorkTitle: "Dynamic Ergonomic Hardware Launch Film",
  },
];

export const HOW_IT_WORKS_BUSINESS: WorkflowStep[] = [
  {
    step: "01",
    title: "Post Briefs With Structured Deliverables",
    description:
      "Define project scope, timeline, milestones, and budget expectations with precise deliverable requirements.",
    deliverableBadge: "Smart Scope Builder",
  },
  {
    step: "02",
    title: "Review Curated Portfolios & Assemble Teams",
    description:
      "Directly review verified portfolio reels, check past client feedback, and hire an individual or an entire cross-functional creative crew.",
    deliverableBadge: "No Bidding Spam",
  },
  {
    step: "03",
    title: "Collaborate in Shared Workspaces & Release Escrow",
    description:
      "Track milestones in real-time, inspect high-res deliverables, request timestamped revisions, and release secure milestone payments with complete peace of mind.",
    deliverableBadge: "Milestone Protection",
  },
];

export const HOW_IT_WORKS_FREELANCER: WorkflowStep[] = [
  {
    step: "01",
    title: "Showcase Your Craft With an Editorial Portfolio",
    description:
      "Set up your professional profile highlighting 4K showreels, high-res galleries, published case studies, and verified client history.",
    deliverableBadge: "Verified Creator Badge",
  },
  {
    step: "02",
    title: "Receive Direct Inquiries From Visionary Brands",
    description:
      "Say goodbye to low-ball bidding wars. Receive direct collaboration invitations matched to your rates and aesthetic caliber.",
    deliverableBadge: "Protected Rates",
  },
  {
    step: "03",
    title: "Deliver With Confidence & Enjoy Guaranteed Payouts",
    description:
      "Work with locked milestone deposits. As deliverables are approved, funds are directly deposited into your bank account on time, every time.",
    deliverableBadge: "Guaranteed Payouts",
  },
];
