/*
  Warnings:

  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Project";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Intake" (
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
    "userId" TEXT NOT NULL,
    CONSTRAINT "Intake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
