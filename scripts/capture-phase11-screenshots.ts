import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "C:/Users/Rithvik_mittapalli/.gemini/antigravity-ide/brain/72671783-fe1a-4cb8-b615-3a37b4ecff07";
const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("================================================================================");
  console.log("PHASE 11 AUTOMATED CHROMIUM SCREENSHOT & BROWSER E2E VERIFICATION");
  console.log("================================================================================");

  // 1. Get admin session token from DB
  const { prisma } = await import("../src/lib/prisma");
  const { createSession } = await import("../src/lib/auth/session");

  let admin = await prisma.user.findUnique({ where: { email: "admin.e2e@crewn.com" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "admin.e2e@crewn.com",
        name: "Platform Administrator",
        role: "ADMIN",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
    });
  }
  const session = await createSession({ userId: admin.id });
  const token = session.token;

  console.log(`Admin session created with token: ${token.substring(0, 10)}...`);

  // 2. Launch Chromium browser
  const browser = await chromium.launch({ headless: true });

  // Desktop Context (1280x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });

  await desktopContext.addCookies([
    {
      name: "crewn_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await desktopContext.newPage();

  const screenshotsTaken: { name: string; path: string; description: string }[] = [];

  async function takeScreenshot(name: string, description: string) {
    const filename = `${name}.png`;
    const filepath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    screenshotsTaken.push({ name, path: filepath, description });
    console.log(`[SCREENSHOT] Saved ${filename} - ${description}`);
  }

  // 1. Admin Dashboard (Desktop Dark)
  console.log("Navigating to /admin...");
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_01_admin_dashboard_dark", "Admin Platform Operations Dashboard (Dark Mode)");

  // 2. Admin Users Management (Desktop Dark)
  console.log("Navigating to /admin/users...");
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_02_admin_users_index", "Admin User Management & Moderation Controls");

  // Filter users search
  const searchInput = page.locator('input[placeholder*="Search by name"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("e2e");
    await page.waitForTimeout(600);
    await takeScreenshot("phase11_03_admin_users_search", "Admin User Search & Filtering by Role/Status");
  }

  // 3. Admin Disputes Management (Desktop Dark)
  console.log("Navigating to /admin/disputes...");
  await page.goto(`${BASE_URL}/admin/disputes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_04_admin_disputes_index", "Admin Disputes Triage & Financial Escrow Resolution Queue");

  // Click on a dispute if present
  const viewDisputeBtn = page.locator("a:has-text('Inspect Case'), a:has-text('View Case'), a[href*='/admin/disputes/']").first();
  if (await viewDisputeBtn.isVisible()) {
    await viewDisputeBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await takeScreenshot("phase11_05_admin_dispute_detail", "Admin Dispute Evidence History & Escrow Decision Controls");
  }

  // 4. Admin Moderation Reports Queue
  console.log("Navigating to /admin/moderation...");
  await page.goto(`${BASE_URL}/admin/moderation`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_06_admin_moderation_queue", "Platform Moderation & Content Safety Review Queue");

  // 5. Admin Immutable Audit Log Ledger
  console.log("Navigating to /admin/audit-log...");
  await page.goto(`${BASE_URL}/admin/audit-log`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_07_admin_audit_log_ledger", "Immutable Platform Activity & Security Audit Ledger");

  // 6. Admin System Health & Diagnostic Telemetry
  console.log("Navigating to /admin/system...");
  await page.goto(`${BASE_URL}/admin/system`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeScreenshot("phase11_08_admin_system_health", "Live PostgreSQL Latency, Webhook & Session Health Diagnostics");

  // 7. Light Mode Check on Admin Dashboard
  const lightContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
  });
  await lightContext.addCookies([
    {
      name: "crewn_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const lightPage = await lightContext.newPage();
  await lightPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await lightPage.waitForTimeout(1000);
  const lightFile = path.join(ARTIFACT_DIR, "phase11_09_admin_dashboard_light.png");
  await lightPage.screenshot({ path: lightFile, fullPage: false });
  screenshotsTaken.push({
    name: "phase11_09_admin_dashboard_light",
    path: lightFile,
    description: "Admin Operations Dashboard in Clean Light Mode",
  });
  console.log("[SCREENSHOT] Saved phase11_09_admin_dashboard_light.png");

  // 8. Mobile Responsive Layout (390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    isMobile: true,
    hasTouch: true,
  });
  await mobileContext.addCookies([
    {
      name: "crewn_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  const mobileFile = path.join(ARTIFACT_DIR, "phase11_10_admin_mobile_layout.png");
  await mobilePage.screenshot({ path: mobileFile, fullPage: false });
  screenshotsTaken.push({
    name: "phase11_10_admin_mobile_layout",
    path: mobileFile,
    description: "Responsive Mobile Viewport (390x844) Admin Navigation & Dashboard",
  });
  console.log("[SCREENSHOT] Saved phase11_10_admin_mobile_layout.png");

  await browser.close();

  // Write results JSON
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "browser_phase11_results.json"),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalScreenshots: screenshotsTaken.length,
        screenshots: screenshotsTaken,
      },
      null,
      2
    )
  );

  console.log("\n================================================================================");
  console.log(`SUCCESSFULLY CAPTURED ALL ${screenshotsTaken.length} PHASE 11 LIVE BROWSER SCREENSHOTS!`);
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
