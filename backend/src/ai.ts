import OpenAI from "openai";
import { env } from "./env.js";

// What we ask the model to produce for each intake.
export type IntakeAnalysis = {
  summary: string;
  tags: string[];
  riskChecklist: string[];
};

// The core intake fields we feed to the model.
export type IntakeInput = {
  title: string;
  description: string;
  budgetRange: string;
  timeline: string;
  industry: string;
};

// Observability record for a single analysis attempt. Persisted by the route
// layer into IntakeAnalysisRequest regardless of success/failure.
export type AnalysisLog = {
  model: string;
  schema: unknown;
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string | null;
  status: "success" | "error";
  error: string | null;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
};

// Outcome of an analysis attempt. `log` is present whenever a request was
// actually issued (so it can be recorded); it's null for pre-flight failures
// like a missing API key, where `status` carries an HTTP hint. `retryable`
// tells the orchestrator (routes/intakes.ts) whether re-running this same
// attempt could plausibly succeed (transient transport/output failures) or is
// pointless (missing key, 4xx client/config errors).
export type AnalysisOutcome =
  | { ok: true; analysis: IntakeAnalysis; log: AnalysisLog }
  | {
      ok: false;
      status: number;
      error: string;
      retryable: boolean;
      log: AnalysisLog | null;
    };

// How long to wait on a single OpenAI request before giving up (the SDK default
// is 10 minutes — far too long for a background job we want to bound). The SDK
// also retries transient transport errors (429/5xx/network/timeout) with
// exponential backoff up to `maxRetries` within one attempt.
const REQUEST_TIMEOUT_MS = 30_000;
const SDK_MAX_RETRIES = 2;

// JSON Schema describing the structured output. Used both as the strict
// `response_format` contract AND embedded in the prompt (per project spec).
// Note: OpenAI strict mode requires every property to be `required` and
// `additionalProperties: false`; constraints like minItems are expressed in
// the instructions instead.
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A concise 2-3 sentence summary of the project request.",
    },
    tags: {
      type: "array",
      description: "At least 3 short, lowercase topical tags.",
      items: { type: "string" },
    },
    riskChecklist: {
      type: "array",
      description:
        "Bullet-style delivery/diligence risk items to review for this project.",
      items: { type: "string" },
    },
  },
  required: ["summary", "tags", "riskChecklist"],
  additionalProperties: false,
} as const;

const EXAMPLE: IntakeAnalysis = {
  summary:
    "A global retailer wants a custom AI-powered demand-forecasting platform integrated with their existing SAP ERP. The scope is broad with a 9-month timeline and an enterprise-scale budget, implying a multi-team engagement with significant data and integration work.",
  tags: ["ai-ml", "enterprise", "systems-integration", "data-platform"],
  riskChecklist: [
    "Confirm access to and quality of the historical sales/inventory data needed for forecasting.",
    "Clarify whether the 9-month timeline includes model evaluation, UAT, and production hardening.",
    "Assess integration complexity and API availability of the legacy SAP ERP.",
    "Verify the budget covers ongoing MLOps (retraining, monitoring) beyond initial delivery.",
    "Identify data-privacy and compliance constraints for customer/transaction data.",
  ],
};

const SYSTEM_PROMPT =
  "You are an analyst at a software development company that delivers large, " +
  "custom software projects for enterprise customers, including AI-acceleration " +
  "initiatives. You triage and evaluate incoming project requests to help the " +
  "team decide how to staff and de-risk them. Produce concise, neutral, " +
  "decision-useful analysis, and always respond with JSON matching the " +
  "provided schema.";

function buildUserPrompt(intake: IntakeInput): string {
  return [
    "Analyze the following software development project intake request.",
    "",
    "Return JSON that conforms exactly to this JSON Schema:",
    JSON.stringify(ANALYSIS_SCHEMA, null, 2),
    "",
    "Example of a valid response:",
    JSON.stringify(EXAMPLE, null, 2),
    "",
    "Requirements:",
    "- summary: 2-3 sentences, factual, no marketing language.",
    "- tags: at least 3 short lowercase tags (kebab-case where multi-word), e.g. technology, domain, or engagement type.",
    "- riskChecklist: concrete, reviewable delivery/diligence items as short bullets.",
    "",
    "Intake:",
    `- Title: ${intake.title}`,
    `- Industry: ${intake.industry}`,
    `- Budget range: ${intake.budgetRange}`,
    `- Timeline: ${intake.timeline}`,
    `- Description: ${intake.description}`,
  ].join("\n");
}

// Run a single analysis attempt. Never throws for OpenAI/parse failures —
// instead returns a structured outcome (with a log to persist) so the caller
// can record metrics and surface a recoverable error.
export async function performAnalysis(
  intake: IntakeInput,
): Promise<AnalysisOutcome> {
  if (!env.openaiApiKey) {
    return {
      ok: false,
      status: 503,
      error: "OpenAI API key is not configured. Set OPENAI_API_KEY in your .env.",
      // A missing key won't fix itself between retries — terminal.
      retryable: false,
      log: null,
    };
  }

  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    maxRetries: SDK_MAX_RETRIES,
    timeout: REQUEST_TIMEOUT_MS,
  });
  const userPrompt = buildUserPrompt(intake);
  const startedAt = new Date();

  const baseLog = {
    model: env.openaiModel,
    schema: ANALYSIS_SCHEMA,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    startedAt,
  };

  const fail = (
    error: string,
    rawResponse: string | null,
    status = 502,
    retryable = true,
  ): AnalysisOutcome => {
    const completedAt = new Date();
    return {
      ok: false,
      status,
      error,
      retryable,
      log: {
        ...baseLog,
        rawResponse,
        status: "error",
        error,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  };

  let rawResponse: string | null = null;
  try {
    const completion = await client.chat.completions.create({
      model: env.openaiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intake_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    });
    rawResponse = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    const status = (err as { status?: number } | null)?.status;
    // 4xx other than 429 (bad request, auth, not found) are client/config
    // errors that won't change on retry. Everything else — 429, 5xx, and
    // network/timeout failures the SDK already exhausted — may still be a
    // transient outage worth another attempt.
    const terminal =
      typeof status === "number" && status >= 400 && status < 500 && status !== 429;
    return fail(`OpenAI request failed: ${message}`, null, status ?? 502, !terminal);
  }

  if (!rawResponse) {
    return fail("OpenAI returned an empty response.", null);
  }

  let parsed: IntakeAnalysis;
  try {
    parsed = JSON.parse(rawResponse) as IntakeAnalysis;
  } catch {
    return fail("OpenAI returned invalid JSON.", rawResponse);
  }

  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.tags) ||
    !Array.isArray(parsed.riskChecklist)
  ) {
    return fail("OpenAI response did not match the expected shape.", rawResponse);
  }

  const completedAt = new Date();
  return {
    ok: true,
    analysis: parsed,
    log: {
      ...baseLog,
      rawResponse,
      status: "success",
      error: null,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  };
}
