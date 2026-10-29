-- Project metadata and escrow opportunities are stored off-chain. These tables
-- were present in the Prisma schema but had not been added to migration history.
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onChainId" INTEGER,
    "publisherAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailedDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "technologies" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "liveDappUrl" TEXT NOT NULL,
    "demoVideoUrl" TEXT,
    "metadataURI" TEXT,
    "metadataHash" TEXT,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onChainId" INTEGER,
    "projectId" TEXT NOT NULL,
    "publisherAddress" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "requiredSkills" TEXT NOT NULL,
    "rewardEth" TEXT NOT NULL,
    "rewardWei" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "issueUrl" TEXT,
    "metadataURI" TEXT,
    "metadataHash" TEXT,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "selectedSubmissionId" TEXT,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onChainId" INTEGER,
    "opportunityId" TEXT NOT NULL,
    "contributorAddress" TEXT NOT NULL,
    "githubUsername" TEXT,
    "githubUserId" TEXT,
    "prUrl" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isMerged" BOOLEAN NOT NULL DEFAULT false,
    "mergedAt" DATETIME,
    "latestCommitSha" TEXT,
    "isRewardReady" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "paidTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_opportunityId_fkey"
        FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep the earliest verified record if an earlier deployment accepted the same
-- pull request more than once. A PR has one canonical ContribChain submission.
DELETE FROM "VerifiedSubmission"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (
            PARTITION BY "chainAddress", "repoId", "prNumber"
            ORDER BY "createdAt", "id"
        ) AS row_number
        FROM "VerifiedSubmission"
    )
    WHERE row_number > 1
);

CREATE UNIQUE INDEX "VerifiedSubmission_chainAddress_repoId_prNumber_key"
    ON "VerifiedSubmission"("chainAddress", "repoId", "prNumber");
CREATE INDEX "Project_publisherAddress_idx" ON "Project"("publisherAddress");
CREATE UNIQUE INDEX "Project_onChainId_key" ON "Project"("onChainId");
CREATE INDEX "Opportunity_projectId_state_idx" ON "Opportunity"("projectId", "state");
CREATE INDEX "Opportunity_publisherAddress_idx" ON "Opportunity"("publisherAddress");
CREATE UNIQUE INDEX "Opportunity_onChainId_key" ON "Opportunity"("onChainId");
CREATE UNIQUE INDEX "Submission_repoOwner_repoName_prNumber_key"
    ON "Submission"("repoOwner", "repoName", "prNumber");
CREATE UNIQUE INDEX "Submission_opportunityId_contributorAddress_key"
    ON "Submission"("opportunityId", "contributorAddress");
CREATE INDEX "Submission_opportunityId_status_idx" ON "Submission"("opportunityId", "status");
CREATE INDEX "Submission_contributorAddress_idx" ON "Submission"("contributorAddress");
CREATE UNIQUE INDEX "Submission_onChainId_key" ON "Submission"("onChainId");
