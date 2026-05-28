-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Intake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetRange" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "summary" TEXT,
    "tags" JSONB,
    "riskChecklist" JSONB,
    "analyzedAt" DATETIME,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "analysisError" TEXT,
    "analysisRunCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Intake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Intake" ("analyzedAt", "budgetRange", "createdAt", "description", "id", "industry", "riskChecklist", "summary", "tags", "timeline", "title", "updatedAt", "userId") SELECT "analyzedAt", "budgetRange", "createdAt", "description", "id", "industry", "riskChecklist", "summary", "tags", "timeline", "title", "updatedAt", "userId" FROM "Intake";
DROP TABLE "Intake";
ALTER TABLE "new_Intake" RENAME TO "Intake";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill the lifecycle column: rows already analyzed are 'completed';
-- everything else keeps the 'pending' default (idle, never analyzed).
UPDATE "Intake" SET "analysisStatus" = 'completed' WHERE "analyzedAt" IS NOT NULL;
