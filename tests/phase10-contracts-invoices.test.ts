import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { hashToken } from "../src/lib/auth/session";

// Service under test
import {
  createContractDraft,
  updateContractDraft,
  sendContractForSignature,
  signContract,
  declineContract,
  isValidContractTransition,
  generateContractSnapshotHash,
} from "../src/lib/contracts/service";

import {
  generateInvoiceFromMilestone,
  generateConcurrencySafeInvoiceNumber,
  isValidInvoiceTransition,
  markInvoicePaid,
  voidInvoice,
} from "../src/lib/invoices/service";

import { generateInvoicePdfBuffer } from "../src/lib/invoices/pdf";

// API routes
import { GET as getContracts, POST as postContract } from "../src/app/api/projects/[projectId]/contracts/route";
import { GET as getContractDetail, PATCH as patchContract } from "../src/app/api/contracts/[contractId]/route";
import { POST as signContractRoute } from "../src/app/api/contracts/[contractId]/sign/route";
import { POST as generateInvoiceRoute } from "../src/app/api/projects/[projectId]/milestones/[milestoneId]/invoice/route";
import { GET as getInvoicePdfRoute } from "../src/app/api/invoices/[invoiceId]/pdf/route";
import { GET as listInvoicesRoute } from "../src/app/api/invoices/route";

// ─── Test Suite ───────────────────────────────────────────────────────────────

test("Phase 10: Contracts & Invoice PDF Generation Suite", async (t) => {
  const timestamp = Date.now();

  let businessUser: { id: string; email: string };
  let freelancerUser: { id: string; email: string };
  let outsiderUser: { id: string; email: string };
  let tokenBusiness: string;
  let tokenFreelancer: string;
  let tokenOutsider: string;
  let business: { id: string };
  let project: { id: string };
  let milestone: { id: string; amount: any };

  t.before(async () => {
    // 1. Users
    businessUser = await prisma.user.create({
      data: {
        email: `biz-ph10-${timestamp}@crewn.test`,
        name: "Biz Owner Phase10",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    freelancerUser = await prisma.user.create({
      data: {
        email: `creator-ph10-${timestamp}@crewn.test`,
        name: "Creator Phase10",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider-ph10-${timestamp}@crewn.test`,
        name: "Outsider Phase10",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    // 2. Sessions
    tokenBusiness = crypto.randomBytes(32).toString("hex");
    tokenFreelancer = crypto.randomBytes(32).toString("hex");
    tokenOutsider = crypto.randomBytes(32).toString("hex");

    await prisma.session.create({
      data: {
        userId: businessUser.id,
        tokenHash: hashToken(tokenBusiness),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });
    await prisma.session.create({
      data: {
        userId: freelancerUser.id,
        tokenHash: hashToken(tokenFreelancer),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });
    await prisma.session.create({
      data: {
        userId: outsiderUser.id,
        tokenHash: hashToken(tokenOutsider),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    // 3. Business + project
    business = await prisma.business.create({
      data: {
        name: `Phase10 Studio ${timestamp}`,
        slug: `ph10-studio-${timestamp}`,
        members: {
          create: [{ userId: businessUser.id, role: "OWNER" }],
        },
      },
      select: { id: true },
    });

    project = await prisma.project.create({
      data: {
        businessId: business.id,
        createdById: businessUser.id,
        title: `Phase10 Campaign ${timestamp}`,
        description: "Contract and invoice test project",
        status: "IN_PROGRESS",
        members: {
          create: [
            { userId: businessUser.id, role: "OWNER" },
            { userId: freelancerUser.id, role: "FREELANCER" },
          ],
        },
      },
      select: { id: true },
    });

    // 4. Milestone
    const ms = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: `Phase10 Milestone ${timestamp}`,
        amount: 50000,
        status: "ACTIVE",
      },
      select: { id: true, amount: true },
    });
    milestone = ms;
  });

  t.after(async () => {
    await prisma.invoiceSequence.deleteMany({}).catch(() => {});
    await prisma.invoice.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.contractParty.deleteMany({ where: { contract: { projectId: project.id } } }).catch(() => {});
    await prisma.contract.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.milestone.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: project.id } }).catch(() => {});
    await prisma.businessMember.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.business.deleteMany({ where: { id: business.id } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: { in: [businessUser.id, freelancerUser.id, outsiderUser.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [businessUser.id, freelancerUser.id, outsiderUser.id] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Contract state machine validations
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("1. Contract state machine enforces valid transitions", () => {
    assert.ok(isValidContractTransition("DRAFT", "SENT"), "DRAFT->SENT must be valid");
    assert.ok(isValidContractTransition("SENT", "EXECUTED"), "SENT->EXECUTED must be valid");
    assert.ok(isValidContractTransition("SENT", "DECLINED"), "SENT->DECLINED must be valid");
    assert.ok(isValidContractTransition("SENT", "TERMINATED"), "SENT->TERMINATED must be valid");
    assert.ok(!isValidContractTransition("EXECUTED", "SENT"), "EXECUTED->SENT must be invalid");
    assert.ok(!isValidContractTransition("TERMINATED", "SENT"), "TERMINATED->SENT must be invalid");
    assert.ok(!isValidContractTransition("DECLINED", "EXECUTED"), "DECLINED->EXECUTED must be invalid");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Invoice state machine validations
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("2. Invoice state machine enforces valid transitions", () => {
    assert.ok(isValidInvoiceTransition("DRAFT", "ISSUED"), "DRAFT->ISSUED must be valid");
    assert.ok(isValidInvoiceTransition("ISSUED", "PAID"), "ISSUED->PAID must be valid");
    assert.ok(isValidInvoiceTransition("ISSUED", "VOID"), "ISSUED->VOID must be valid");
    assert.ok(!isValidInvoiceTransition("PAID", "VOID"), "PAID->VOID must be invalid");
    assert.ok(!isValidInvoiceTransition("VOID", "PAID"), "VOID->PAID must be invalid");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Contract snapshot hash is deterministic and tamper-evident
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("3. Contract snapshot hash is deterministic and tamper-evident", () => {
    const payload = {
      contractId: "cid-001",
      title: "Video Production Agreement",
      totalAmount: 50000,
      parties: [{ userId: "u1", role: "CLIENT_SIGNER", signedAt: "2026-09-27T10:00:00Z" }],
    };
    const hash1 = generateContractSnapshotHash(payload);
    const hash2 = generateContractSnapshotHash(payload);
    assert.equal(hash1, hash2, "Same payload must produce the same hash");
    assert.equal(hash1.length, 64, "SHA-256 hex must be 64 characters");

    // Tamper with payload
    const tampered = { ...payload, totalAmount: 49999 };
    const hash3 = generateContractSnapshotHash(tampered);
    assert.notEqual(hash1, hash3, "Tampered payload must produce different hash");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Full contract lifecycle: create → send → sign (both parties) → EXECUTED
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("4. Full contract lifecycle: DRAFT → SENT → EXECUTED with dual signature", async () => {
    // 4a. Create draft
    const draft = await createContractDraft({
      projectId: project.id,
      businessId: business.id,
      authorUserId: businessUser.id,
      title: "Full Lifecycle Production Agreement",
      termsText: "Both parties agree to the terms.",
      totalAmount: 50000,
      scopeOfWork: "Social media video series production.",
      deliverablesText: "3x 60-second videos, edit files, raw footage.",
      paymentTerms: "Payment via escrow upon milestone approval.",
      revisionTerms: "Up to 2 revision rounds per video.",
      effectiveDate: new Date().toISOString(),
    });

    assert.equal(draft.status, "DRAFT");
    assert.ok(draft.parties.some((p) => p.userId === businessUser.id && p.role === "CLIENT_SIGNER"));
    assert.ok(draft.parties.some((p) => p.userId === freelancerUser.id && p.role === "FREELANCER_SIGNER"));

    // 4b. Send for signature
    const sent = await sendContractForSignature(draft.id, businessUser.id);
    assert.equal(sent.status, "SENT");

    // 4c. Business user signs first
    const fakeSigDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const afterBizSign = await signContract({
      contractId: draft.id,
      userId: businessUser.id,
      signatureDataUrl: fakeSigDataUrl,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });
    // Not yet executed (freelancer hasn't signed)
    assert.equal(afterBizSign.status, "SENT");

    // 4d. Freelancer signs — triggers EXECUTED transition
    const executed = await signContract({
      contractId: draft.id,
      userId: freelancerUser.id,
      signatureDataUrl: fakeSigDataUrl,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });
    assert.equal(executed.status, "EXECUTED");
    assert.ok(executed.executedAt, "executedAt must be set");
    assert.ok(executed.signedSnapshotJson, "signedSnapshotJson must be stored");

    // 4e. Verify snapshot integrity
    const snapshot = JSON.parse(executed.signedSnapshotJson!);
    assert.ok(snapshot.integrityHash, "Snapshot must include integrity hash");
    assert.equal(snapshot.version, "1.0");
    assert.ok(snapshot.parties.every((p: { signedAt?: string }) => p.signedAt), "All parties must have signedAt in snapshot");

    // 4f. Cannot sign an already executed contract
    await assert.rejects(
      signContract({
        contractId: draft.id,
        userId: businessUser.id,
        signatureDataUrl: fakeSigDataUrl,
      }),
      /already been fully executed/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Contract draft update is restricted to DRAFT status
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("5. Contract draft editing is locked once sent", async () => {
    const draft = await createContractDraft({
      projectId: project.id,
      businessId: business.id,
      authorUserId: businessUser.id,
      title: "Editable Draft",
      termsText: "Original terms.",
      totalAmount: 10000,
    });

    // Can edit while DRAFT
    const updated = await updateContractDraft({
      contractId: draft.id,
      userId: businessUser.id,
      title: "Updated Draft Title",
      termsText: "Revised terms for the engagement.",
    });
    assert.equal(updated.title, "Updated Draft Title");

    // Send contract
    await sendContractForSignature(draft.id, businessUser.id);

    // Cannot edit once SENT
    await assert.rejects(
      updateContractDraft({
        contractId: draft.id,
        userId: businessUser.id,
        title: "Attempted Edit After Sending",
      }),
      /Only DRAFT contracts can be edited/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Contract decline flow with documented reason
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("6. Freelancer can decline a SENT contract with a reason", async () => {
    const draft = await createContractDraft({
      projectId: project.id,
      businessId: business.id,
      authorUserId: businessUser.id,
      title: "Decline Test Contract",
      termsText: "These terms are unacceptable.",
      totalAmount: 5000,
    });

    await sendContractForSignature(draft.id, businessUser.id);

    const declined = await declineContract({
      contractId: draft.id,
      userId: freelancerUser.id,
      reason: "Payment terms do not align with our standard rate card.",
    });

    assert.equal(declined.status, "DECLINED");
    assert.ok(declined.declineReason?.includes("rate card"));

    // Cannot sign a declined contract
    const fakeSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    await assert.rejects(
      signContract({
        contractId: draft.id,
        userId: businessUser.id,
        signatureDataUrl: fakeSig,
      }),
      /must be SENT/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Unauthorized user cannot sign a contract they are not party to
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("7. Unauthorized user cannot sign a contract they are not party to", async () => {
    const draft = await createContractDraft({
      projectId: project.id,
      businessId: business.id,
      authorUserId: businessUser.id,
      title: "Auth Test Contract",
      termsText: "Protected contract.",
      totalAmount: 7500,
    });
    await sendContractForSignature(draft.id, businessUser.id);

    const fakeSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    await assert.rejects(
      signContract({
        contractId: draft.id,
        userId: outsiderUser.id,
        signatureDataUrl: fakeSig,
      }),
      /not a designated signing party/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Contract API routes: GET list, POST create, PATCH, sign
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("8. Contract API routes respond correctly with auth", async () => {
    // Unauthorized list
    const reqNoAuth = new NextRequest(`http://localhost:3000/api/projects/${project.id}/contracts`);
    const resNoAuth = await getContracts(reqNoAuth, {
      params: Promise.resolve({ projectId: project.id }),
    });
    assert.equal(resNoAuth.status, 403); // requireProjectMember returns null → 403

    // Authorized list
    const reqList = new NextRequest(`http://localhost:3000/api/projects/${project.id}/contracts`, {
      headers: { cookie: `crewn_session=${tokenBusiness}` },
    });
    const resList = await getContracts(reqList, {
      params: Promise.resolve({ projectId: project.id }),
    });
    assert.equal(resList.status, 200);
    const listData = await resList.json();
    assert.ok(Array.isArray(listData.contracts));

    // Outsider cannot create
    const reqOutsiderCreate = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/contracts`,
      {
        method: "POST",
        headers: {
          cookie: `crewn_session=${tokenOutsider}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Bad Create", termsText: "...", totalAmount: 1000 }),
      }
    );
    const resOutsiderCreate = await postContract(reqOutsiderCreate, {
      params: Promise.resolve({ projectId: project.id }),
    });
    assert.equal(resOutsiderCreate.status, 403);

    // Business owner creates contract via API
    const reqCreate = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/contracts`,
      {
        method: "POST",
        headers: {
          cookie: `crewn_session=${tokenBusiness}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "API Route Test Contract",
          termsText: "Contract created via API route test.",
          totalAmount: 12000,
          scopeOfWork: "Brand video production",
        }),
      }
    );
    const resCreate = await postContract(reqCreate, {
      params: Promise.resolve({ projectId: project.id }),
    });
    assert.equal(resCreate.status, 201);
    const createData = await resCreate.json();
    assert.ok(createData.contract.id);
    assert.equal(createData.contract.status, "DRAFT");

    // GET single contract
    const contractId = createData.contract.id;
    const reqGet = new NextRequest(`http://localhost:3000/api/contracts/${contractId}`, {
      headers: { cookie: `crewn_session=${tokenBusiness}` },
    });
    const resGet = await getContractDetail(reqGet, {
      params: Promise.resolve({ contractId }),
    });
    assert.equal(resGet.status, 200);
    const getContractData = await resGet.json();
    assert.equal(getContractData.contract.id, contractId);

    // Outsider cannot view contract detail
    const reqOutsiderGet = new NextRequest(`http://localhost:3000/api/contracts/${contractId}`, {
      headers: { cookie: `crewn_session=${tokenOutsider}` },
    });
    const resOutsiderGet = await getContractDetail(reqOutsiderGet, {
      params: Promise.resolve({ contractId }),
    });
    assert.equal(resOutsiderGet.status, 403);

    // PATCH: send for signature
    const reqSend = new NextRequest(`http://localhost:3000/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: {
        cookie: `crewn_session=${tokenBusiness}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "send" }),
    });
    const resSend = await patchContract(reqSend, {
      params: Promise.resolve({ contractId }),
    });
    assert.equal(resSend.status, 200);
    const sendData = await resSend.json();
    assert.equal(sendData.contract.status, "SENT");

    // POST /sign
    const fakeSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const reqSign = new NextRequest(`http://localhost:3000/api/contracts/${contractId}/sign`, {
      method: "POST",
      headers: {
        cookie: `crewn_session=${tokenBusiness}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signatureDataUrl: fakeSig }),
    });
    const resSign = await signContractRoute(reqSign, {
      params: Promise.resolve({ contractId }),
    });
    assert.equal(resSign.status, 200);

    // Reject missing signature data
    const reqBadSign = new NextRequest(`http://localhost:3000/api/contracts/${contractId}/sign`, {
      method: "POST",
      headers: {
        cookie: `crewn_session=${tokenFreelancer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signatureDataUrl: "not-a-valid-data-url" }),
    });
    const resBadSign = await signContractRoute(reqBadSign, {
      params: Promise.resolve({ contractId }),
    });
    assert.equal(resBadSign.status, 400);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Invoice generation from milestone
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("9. Invoice is generated from a milestone with correct amounts", async () => {
    const invoice = await generateInvoiceFromMilestone({
      projectId: project.id,
      milestoneId: milestone.id,
      authorUserId: businessUser.id,
    });

    assert.ok(invoice.invoiceNumber.startsWith("INV-"), "Invoice number must start with INV-");
    assert.equal(invoice.status, "ISSUED");
    assert.equal(Number(invoice.totalAmount), Number(milestone.amount));
    assert.ok(Number(invoice.subtotalAmount) > 0, "Subtotal must be positive");

    // Idempotent: calling again returns same invoice
    const sameInvoice = await generateInvoiceFromMilestone({
      projectId: project.id,
      milestoneId: milestone.id,
      authorUserId: businessUser.id,
    });
    assert.equal(sameInvoice.id, invoice.id, "Repeat call must return same invoice (idempotent)");

    // Mark as paid
    const paid = await markInvoicePaid({
      invoiceId: invoice.id,
      paymentReference: "PAY-PH10-TEST-001",
    });
    assert.equal(paid.status, "PAID");
    assert.ok(paid.paidAt);

    // Cannot void a paid invoice
    await assert.rejects(
      voidInvoice(invoice.id, businessUser.id),
      /Cannot void a paid invoice/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Concurrency-safe invoice number generation
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("10. Concurrent invoice number generation produces unique numbers", async () => {
    // Generate 5 invoice numbers concurrently
    const results = await Promise.all([
      generateConcurrencySafeInvoiceNumber(),
      generateConcurrencySafeInvoiceNumber(),
      generateConcurrencySafeInvoiceNumber(),
      generateConcurrencySafeInvoiceNumber(),
      generateConcurrencySafeInvoiceNumber(),
    ]);

    const unique = new Set(results);
    assert.equal(unique.size, 5, "All 5 concurrently generated invoice numbers must be unique");
    for (const num of results) {
      assert.match(num, /^INV-\d{6}-\d{4}$/, `Invoice number '${num}' must match INV-YYYYMM-XXXX`);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Invoice PDF buffer generation produces valid PDF
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("11. Invoice PDF buffer is generated correctly", async () => {
    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber: "INV-202609-0001",
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paidAt: null,
      status: "ISSUED",
      currency: "INR",
      subtotalAmount: 50000,
      platformFeeAmount: 2500,
      taxAmount: 0,
      totalAmount: 50000,
      paymentReference: null,
      notes: "Thank you for your business.",
      business: {
        name: "Apex Media Studios",
        legalName: "Apex Media Studios Pvt Ltd",
        taxId: "29AABCA1234A1ZK",
        website: "https://apexmedia.in",
      },
      recipient: {
        name: "Riya Sharma",
        email: "riya@crewn.test",
      },
      items: [
        { description: "Brand Video Production — Milestone 1", quantity: 1, unitPrice: 50000, total: 50000 },
        { description: "Platform Processing & Escrow Service Fee (5%)", quantity: 1, unitPrice: 2500, total: 2500 },
      ],
    });

    assert.ok(Buffer.isBuffer(pdfBuffer), "Output must be a Buffer");
    assert.ok(pdfBuffer.length > 1000, "PDF buffer must be non-trivial in size");

    // All PDFs start with the %PDF- header
    const pdfHeader = pdfBuffer.slice(0, 5).toString("ascii");
    assert.equal(pdfHeader, "%PDF-", "Buffer must start with PDF magic bytes");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Invoice PDF download route: auth + content-type validation
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("12. Invoice PDF download API route is auth-gated and returns PDF", async () => {
    // Create a fresh invoice for this test
    const ms2 = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: `PDF Test Milestone ${timestamp}`,
        amount: 25000,
        status: "ACTIVE",
      },
    });

    const invoice = await generateInvoiceFromMilestone({
      projectId: project.id,
      milestoneId: ms2.id,
      authorUserId: businessUser.id,
    });

    // Unauthorized
    const reqNoAuth = new NextRequest(
      `http://localhost:3000/api/invoices/${invoice.id}/pdf`
    );
    const resNoAuth = await getInvoicePdfRoute(reqNoAuth, {
      params: Promise.resolve({ invoiceId: invoice.id }),
    });
    assert.equal(resNoAuth.status, 401);

    // Authorized (business user)
    const reqAuth = new NextRequest(
      `http://localhost:3000/api/invoices/${invoice.id}/pdf`,
      { headers: { cookie: `crewn_session=${tokenBusiness}` } }
    );
    const resAuth = await getInvoicePdfRoute(reqAuth, {
      params: Promise.resolve({ invoiceId: invoice.id }),
    });
    assert.equal(resAuth.status, 200);
    assert.equal(resAuth.headers.get("Content-Type"), "application/pdf");
    assert.ok(resAuth.headers.get("Content-Disposition")?.includes(invoice.invoiceNumber));

    // Outsider cannot download
    const reqOutsider = new NextRequest(
      `http://localhost:3000/api/invoices/${invoice.id}/pdf`,
      { headers: { cookie: `crewn_session=${tokenOutsider}` } }
    );
    const resOutsider = await getInvoicePdfRoute(reqOutsider, {
      params: Promise.resolve({ invoiceId: invoice.id }),
    });
    assert.equal(resOutsider.status, 403);

    // Cleanup extra milestone
    await prisma.invoice.deleteMany({ where: { milestoneId: ms2.id } });
    await prisma.milestone.deleteMany({ where: { id: ms2.id } });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Invoice list API route returns role-filtered results
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("13. Invoice list API returns correct results for business and freelancer roles", async () => {
    // Business owner should see invoices for their business
    const reqBiz = new NextRequest("http://localhost:3000/api/invoices", {
      headers: { cookie: `crewn_session=${tokenBusiness}` },
    });
    const resBiz = await listInvoicesRoute(reqBiz);
    assert.equal(resBiz.status, 200);
    const bizData = await resBiz.json();
    assert.ok(Array.isArray(bizData.invoices), "Business invoices must be an array");

    // Freelancer (recipient) should see their invoices
    const reqFl = new NextRequest("http://localhost:3000/api/invoices", {
      headers: { cookie: `crewn_session=${tokenFreelancer}` },
    });
    const resFl = await listInvoicesRoute(reqFl);
    assert.equal(resFl.status, 200);
    const flData = await resFl.json();
    assert.ok(Array.isArray(flData.invoices), "Freelancer invoices must be an array");

    // Unauthenticated → 401
    const reqUnauth = new NextRequest("http://localhost:3000/api/invoices");
    const resUnauth = await listInvoicesRoute(reqUnauth);
    assert.equal(resUnauth.status, 401);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. Invoice generation route via API
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("14. Invoice generation route creates invoice via API and is idempotent", async () => {
    const ms3 = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: `Invoice API Test Milestone ${timestamp}`,
        amount: 15000,
        status: "ACTIVE",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/milestones/${ms3.id}/invoice`,
      {
        method: "POST",
        headers: { cookie: `crewn_session=${tokenBusiness}` },
      }
    );
    const res = await generateInvoiceRoute(req, {
      params: Promise.resolve({ projectId: project.id, milestoneId: ms3.id }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.invoice.id);
    assert.equal(data.invoice.status, "ISSUED");

    // Repeat call → idempotent 201
    const req2 = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/milestones/${ms3.id}/invoice`,
      {
        method: "POST",
        headers: { cookie: `crewn_session=${tokenBusiness}` },
      }
    );
    const res2 = await generateInvoiceRoute(req2, {
      params: Promise.resolve({ projectId: project.id, milestoneId: ms3.id }),
    });
    assert.equal(res2.status, 201);
    const data2 = await res2.json();
    assert.equal(data2.invoice.id, data.invoice.id, "Same invoice must be returned on repeated call");

    // Cleanup
    await prisma.invoice.deleteMany({ where: { milestoneId: ms3.id } });
    await prisma.milestone.deleteMany({ where: { id: ms3.id } });
  });
});
