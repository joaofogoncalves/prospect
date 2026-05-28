-- CreateTable
CREATE TABLE "IntakeAnalysisRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intakeId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "rawResponse" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntakeAnalysisRequest_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
