// Seed data for local development and manual testing.
//
// Populates the dev database with a handful of users and a realistic spread of
// intakes so the collaborative list (mine vs. others), the per-creator filter,
// date sorting, and the "not analyzed yet" state all have something to show.
//
// Run it directly any time:        npm run db:seed
// It also runs automatically after: npm run db:migrate  /  npm run db:reset
// (wired via the `prisma.seed` config in backend/package.json — `prisma migrate
//  reset` asks for confirmation before wiping, then re-seeds).
//
// The seed is destructive and idempotent: it clears existing users/intakes and
// recreates a known fixed dataset (stable ids), so re-running always lands on
// the same state. Every user shares the password below so you can log in as any
// of them and see the list from their perspective.

import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

// Shared login password for every seeded user. Dev-only convenience.
export const SEED_PASSWORD = "password123";

type SeedUser = { id: string; name: string; email: string };

// Five teammates. `you@example.com` is the obvious account to log in with.
export const seedUsers: SeedUser[] = [
  { id: "seed-user-you", name: "You Tester", email: "you@example.com" },
  { id: "seed-user-dana", name: "Dana Ruiz", email: "dana@example.com" },
  { id: "seed-user-marco", name: "Marco Bianchi", email: "marco@example.com" },
  { id: "seed-user-aisha", name: "Aisha Khan", email: "aisha@example.com" },
  { id: "seed-user-lena", name: "Lena Schmidt", email: "lena@example.com" },
];

type Analysis = { summary: string; tags: string[]; riskChecklist: string[] };

type SeedIntake = {
  id: string;
  userId: string;
  title: string;
  description: string;
  budgetRange: string;
  timeline: string;
  industry: string;
  createdAt: string; // ISO; spread across ~5 years for date sorting/filtering
  // Present => analyzed (analysis baked in). Absent => still "Not analyzed",
  // so the owner can run analysis from the UI to exercise that flow.
  analysis?: Analysis;
};

// ~12 intakes across the five users and several industries. About a quarter are
// intentionally left un-analyzed.
export const seedIntakes: SeedIntake[] = [
  {
    id: "seed-intake-01",
    userId: "seed-user-dana",
    title: "Logistics route optimizer",
    description:
      "Optimize delivery routes across our European fleet, factoring in traffic, delivery windows, and vehicle capacity. Should integrate with the existing dispatch system.",
    budgetRange: "$500K – $1M",
    timeline: "6 months",
    industry: "Logistics",
    createdAt: "2021-04-12T09:15:00.000Z",
    analysis: {
      summary:
        "A logistics operator wants a custom route-optimization tool for its EU fleet, integrated with an existing dispatch system. The scope spans algorithm work and operational integration on a 6-month timeline.",
      tags: ["logistics", "route-optimization", "systems-integration"],
      riskChecklist: [
        "Evaluate availability and quality of historical delivery and traffic data.",
        "Confirm the dispatch system exposes a stable integration API.",
        "Clarify routing constraints (delivery windows, vehicle capacity) to model.",
        "Define how success (cost/time savings) will be measured.",
      ],
    },
  },
  {
    id: "seed-intake-02",
    userId: "seed-user-dana",
    title: "Warehouse robotics planner",
    description:
      "Planning layer to coordinate autonomous mobile robots in a 40,000 sqm warehouse, including pick-path planning and charging schedules.",
    budgetRange: "$1M – $2M",
    timeline: "10 months",
    industry: "Logistics",
    createdAt: "2023-02-03T14:40:00.000Z",
    analysis: {
      summary:
        "A warehouse operator needs a coordination layer for autonomous mobile robots, covering pick-path planning and charging schedules at scale. This is a complex real-time systems engagement.",
      tags: ["robotics", "logistics", "real-time", "optimization"],
      riskChecklist: [
        "Confirm the robot fleet's control API and real-time guarantees.",
        "Assess safety and fallback behavior for planning failures.",
        "Validate throughput targets against floor layout and robot count.",
        "Clarify ongoing support and on-site commissioning expectations.",
      ],
    },
  },
  {
    id: "seed-intake-03",
    userId: "seed-user-you",
    title: "Enterprise demand-forecasting platform",
    description:
      "Build a custom AI demand-forecasting platform integrated with our SAP ERP to predict inventory needs across 200+ stores.",
    budgetRange: "$2M – $4M",
    timeline: "9 months",
    industry: "Retail",
    createdAt: "2026-01-18T11:05:00.000Z",
    analysis: {
      summary:
        "A retailer wants an AI demand-forecasting platform integrated with SAP across 200+ stores. Broad scope with significant data and integration work on a 9-month timeline.",
      tags: ["ai-ml", "enterprise", "systems-integration", "retail"],
      riskChecklist: [
        "Confirm access to and quality of historical sales/inventory data.",
        "Assess SAP integration complexity and API availability.",
        "Verify the budget covers ongoing MLOps (retraining, monitoring).",
        "Identify data-privacy constraints for transaction data.",
      ],
    },
  },
  {
    id: "seed-intake-04",
    userId: "seed-user-you",
    title: "Internal HR knowledge chatbot",
    description:
      "A retrieval-augmented chatbot over our internal HR policies and benefits documents, available in Slack for all employees.",
    budgetRange: "$150K – $300K",
    timeline: "3 months",
    industry: "HR Tech",
    createdAt: "2025-11-09T16:20:00.000Z",
    // Not analyzed yet — run analysis from the UI to try that flow.
  },
  {
    id: "seed-intake-05",
    userId: "seed-user-marco",
    title: "Payments fraud detection",
    description:
      "Real-time fraud scoring for card-not-present transactions, with a feedback loop for analyst-confirmed fraud and chargebacks.",
    budgetRange: "$1M – $2M",
    timeline: "8 months",
    industry: "Fintech",
    createdAt: "2022-06-21T08:30:00.000Z",
    analysis: {
      summary:
        "A fintech wants real-time fraud scoring for card-not-present payments with an analyst feedback loop. Latency, model quality, and compliance are the central concerns.",
      tags: ["fintech", "ai-ml", "real-time", "risk"],
      riskChecklist: [
        "Define latency budget for inline scoring at peak volume.",
        "Confirm labeled fraud data and the analyst feedback pipeline.",
        "Clarify regulatory/PCI constraints on data handling.",
        "Agree on false-positive tolerance and review workflow.",
      ],
    },
  },
  {
    id: "seed-intake-06",
    userId: "seed-user-marco",
    title: "Open banking aggregator",
    description:
      "Aggregate accounts across banks via open-banking APIs and present a unified balance and transactions view with categorization.",
    budgetRange: "$700K – $1.2M",
    timeline: "7 months",
    industry: "Fintech",
    createdAt: "2024-09-14T13:10:00.000Z",
    analysis: {
      summary:
        "A fintech wants to aggregate multi-bank accounts via open-banking APIs into a unified, categorized view. Integration breadth and consent/compliance dominate the risk profile.",
      tags: ["fintech", "open-banking", "systems-integration"],
      riskChecklist: [
        "Map the target banks and the maturity of their open-banking APIs.",
        "Confirm consent management and token-refresh requirements.",
        "Assess transaction-categorization accuracy expectations.",
        "Clarify data-retention and compliance obligations.",
      ],
    },
  },
  {
    id: "seed-intake-07",
    userId: "seed-user-aisha",
    title: "Telehealth scheduling system",
    description:
      "Scheduling and waitlist system for telehealth appointments across multiple clinics, with provider availability and automated reminders.",
    budgetRange: "$400K – $800K",
    timeline: "5 months",
    industry: "Healthcare",
    createdAt: "2022-11-28T10:00:00.000Z",
    analysis: {
      summary:
        "A healthcare provider needs multi-clinic telehealth scheduling with waitlists, provider availability, and reminders. Integration with clinical systems and compliance are key.",
      tags: ["healthcare", "scheduling", "systems-integration"],
      riskChecklist: [
        "Confirm integration points with EHR/clinical calendars.",
        "Clarify HIPAA/data-privacy obligations for patient data.",
        "Define reminder channels (SMS/email) and opt-in handling.",
        "Assess multi-timezone and multi-clinic availability rules.",
      ],
    },
  },
  {
    id: "seed-intake-08",
    userId: "seed-user-aisha",
    title: "Clinical notes summarizer",
    description:
      "Summarize lengthy clinical encounter notes into structured discharge summaries, with clinician review before anything is finalized.",
    budgetRange: "$600K – $1M",
    timeline: "6 months",
    industry: "Healthcare",
    createdAt: "2025-07-02T15:45:00.000Z",
    // Not analyzed yet.
  },
  {
    id: "seed-intake-09",
    userId: "seed-user-lena",
    title: "Factory IoT dashboard",
    description:
      "Real-time dashboard aggregating sensor telemetry from production lines, with threshold alerts and shift-level reporting.",
    budgetRange: "$300K – $600K",
    timeline: "4 months",
    industry: "Manufacturing",
    createdAt: "2021-09-30T07:50:00.000Z",
    analysis: {
      summary:
        "A manufacturer wants a real-time telemetry dashboard with threshold alerting and shift reporting across production lines. Data ingestion reliability and alerting accuracy are central.",
      tags: ["manufacturing", "iot", "real-time", "observability"],
      riskChecklist: [
        "Confirm sensor protocols and ingestion volume/throughput.",
        "Define alert thresholds and escalation responsibilities.",
        "Assess on-prem vs. cloud constraints for plant data.",
        "Clarify historical-data retention for reporting.",
      ],
    },
  },
  {
    id: "seed-intake-10",
    userId: "seed-user-lena",
    title: "Predictive maintenance models",
    description:
      "Predict component failures on CNC machines from vibration and temperature data to schedule maintenance before breakdowns.",
    budgetRange: "$800K – $1.5M",
    timeline: "8 months",
    industry: "Manufacturing",
    createdAt: "2024-03-19T12:25:00.000Z",
    analysis: {
      summary:
        "A manufacturer wants predictive-maintenance models for CNC machines using vibration and temperature signals. Data quality and integration with maintenance workflows drive feasibility.",
      tags: ["manufacturing", "ai-ml", "predictive-maintenance", "iot"],
      riskChecklist: [
        "Confirm sensor data history and labeled failure events.",
        "Clarify how predictions feed the maintenance scheduling process.",
        "Assess model retraining cadence as equipment changes.",
        "Define acceptable lead time and false-alarm tolerance.",
      ],
    },
  },
  {
    id: "seed-intake-11",
    userId: "seed-user-marco",
    title: "Crypto custody portal",
    description:
      "Institutional custody portal for digital assets with multi-sig approvals, audit trails, and role-based access for treasury teams.",
    budgetRange: "$1.5M – $3M",
    timeline: "11 months",
    industry: "Fintech",
    createdAt: "2026-04-05T09:00:00.000Z",
    // Not analyzed yet.
  },
  {
    id: "seed-intake-12",
    userId: "seed-user-you",
    title: "Customer support copilot",
    description:
      "An AI copilot that drafts support replies from our knowledge base and past tickets, with agents always reviewing before sending.",
    budgetRange: "$250K – $500K",
    timeline: "4 months",
    industry: "SaaS",
    createdAt: "2023-12-08T17:30:00.000Z",
    analysis: {
      summary:
        "A SaaS company wants an AI support copilot that drafts replies from its knowledge base and ticket history, with mandatory agent review. Retrieval quality and guardrails are the main risks.",
      tags: ["ai-ml", "saas", "support", "rag"],
      riskChecklist: [
        "Assess quality and coverage of the knowledge base and ticket history.",
        "Define guardrails and the mandatory human-review step.",
        "Clarify integration with the existing helpdesk tool.",
        "Agree on metrics (deflection, handle time) for success.",
      ],
    },
  },
];

// A canned observability record matching the IntakeAnalysisRequest model, so the
// analysis-log view isn't empty for seeded-and-analyzed intakes.
function analysisLog(intake: SeedIntake, analysis: Analysis) {
  const startedAt = new Date(intake.createdAt);
  const completedAt = new Date(startedAt.getTime() + 4200);
  return {
    intakeId: intake.id,
    model: "gpt-4o-mini",
    schema: { type: "object", note: "seeded — see backend/src/ai.ts for the real schema" },
    systemPrompt: "Seeded analysis log (no live OpenAI call was made).",
    userPrompt: `Analyze the intake "${intake.title}".`,
    rawResponse: JSON.stringify(analysis),
    status: "success",
    error: null,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

async function main() {
  // Clear existing data (cascades, but we're explicit). Re-running is safe.
  await prisma.intakeAnalysisRequest.deleteMany();
  await prisma.intake.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of seedUsers) {
    await prisma.user.create({
      data: { id: u.id, name: u.name, email: u.email, passwordHash },
    });
  }

  let analyzedCount = 0;
  for (const it of seedIntakes) {
    const createdAt = new Date(it.createdAt);
    const analyzed = it.analysis;
    const analyzedAt = analyzed
      ? new Date(createdAt.getTime() + 5000)
      : null;

    await prisma.intake.create({
      data: {
        id: it.id,
        title: it.title,
        description: it.description,
        budgetRange: it.budgetRange,
        timeline: it.timeline,
        industry: it.industry,
        createdAt,
        userId: it.userId,
        summary: analyzed?.summary ?? null,
        tags: analyzed?.tags ?? undefined,
        riskChecklist: analyzed?.riskChecklist ?? undefined,
        analyzedAt,
        // Analyzed seed rows are "completed"; the intentionally un-analyzed ones
        // are "pending" (idle — the owner can Generate analysis from the UI).
        analysisStatus: analyzed ? "completed" : "pending",
      },
    });

    if (analyzed) {
      await prisma.intakeAnalysisRequest.create({ data: analysisLog(it, analyzed) });
      analyzedCount += 1;
    }
  }

  console.log(
    `Seeded ${seedUsers.length} users and ${seedIntakes.length} intakes ` +
      `(${analyzedCount} analyzed, ${seedIntakes.length - analyzedCount} pending). ` +
      `All users share the password "${SEED_PASSWORD}".`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
