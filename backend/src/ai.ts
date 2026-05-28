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

// Raised when analysis cannot run/parse. Carries an HTTP status hint.
export class AnalysisError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
  }
}

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
      description: "A concise 2-3 sentence summary of the intake.",
    },
    tags: {
      type: "array",
      description: "At least 3 short, lowercase topical tags.",
      items: { type: "string" },
    },
    riskChecklist: {
      type: "array",
      description:
        "Bullet-style risk/diligence items to review for this intake.",
      items: { type: "string" },
    },
  },
  required: ["summary", "tags", "riskChecklist"],
  additionalProperties: false,
} as const;

const EXAMPLE: IntakeAnalysis = {
  summary:
    "A mid-size municipal water utility is requesting funding to replace aging pipework across three districts. The work is well scoped with a 12-month timeline and a clearly bounded budget.",
  tags: ["infrastructure", "municipal", "water-utility", "capital-improvement"],
  riskChecklist: [
    "Confirm the municipality's current credit rating and outstanding debt.",
    "Verify environmental permits for the affected districts.",
    "Assess contractor availability against the 12-month timeline.",
    "Check whether the budget range includes contingency for material cost inflation.",
  ],
};

function buildUserPrompt(intake: IntakeInput): string {
  return [
    "Analyze the following bond project intake request.",
    "",
    "Return JSON that conforms exactly to this JSON Schema:",
    JSON.stringify(ANALYSIS_SCHEMA, null, 2),
    "",
    "Example of a valid response:",
    JSON.stringify(EXAMPLE, null, 2),
    "",
    "Requirements:",
    "- summary: 2-3 sentences, factual, no marketing language.",
    "- tags: at least 3 short lowercase tags (kebab-case where multi-word).",
    "- riskChecklist: concrete, reviewable diligence items as short bullets.",
    "",
    "Intake:",
    `- Title: ${intake.title}`,
    `- Industry: ${intake.industry}`,
    `- Budget range: ${intake.budgetRange}`,
    `- Timeline: ${intake.timeline}`,
    `- Description: ${intake.description}`,
  ].join("\n");
}

const SYSTEM_PROMPT =
  "You are an analyst that triages bond project funding requests. You produce " +
  "concise, neutral, decision-useful analysis and always respond with JSON " +
  "matching the provided schema.";

export async function analyzeIntake(
  intake: IntakeInput,
): Promise<IntakeAnalysis> {
  if (!env.openaiApiKey) {
    throw new AnalysisError(
      "OpenAI API key is not configured. Set OPENAI_API_KEY in your .env.",
      503,
    );
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: env.openaiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(intake) },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    throw new AnalysisError(`OpenAI request failed: ${message}`);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AnalysisError("OpenAI returned an empty response.");
  }

  let parsed: IntakeAnalysis;
  try {
    parsed = JSON.parse(content) as IntakeAnalysis;
  } catch {
    throw new AnalysisError("OpenAI returned invalid JSON.");
  }

  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.tags) ||
    !Array.isArray(parsed.riskChecklist)
  ) {
    throw new AnalysisError("OpenAI response did not match the expected shape.");
  }

  return parsed;
}
