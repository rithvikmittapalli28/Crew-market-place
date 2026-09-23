import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/context/auth-context";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: "Crewn — Where Visionary Brands Hire Elite Creative Minds",
    template: "%s | Crewn",
  },
  description:
    "A two-sided marketplace and collaborative workspace connecting businesses with vetted photographers, videographers, editors, designers, and creative strategists.",
  keywords: [
    "creative marketplace",
    "freelance videographers",
    "commercial photographers",
    "video editors",
    "brand designers",
    "creative collaboration",
    "milestone escrow",
  ],
  authors: [{ name: "Crewn Technologies" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-foreground selection:text-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
