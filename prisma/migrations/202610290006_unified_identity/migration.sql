-- Attach off-chain ownership and contribution records to the persistent
-- authenticated profile. Unmatched legacy rows remain intact and unlinked.
ALTER TABLE "Project"
  ADD COLUMN "publisherUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD COLUMN "publisherUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD COLUMN "contributorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Project"
SET "publisherUserId" = COALESCE(
  (SELECT "userId" FROM "WalletLink" WHERE lower("address") = lower("Project"."publisherAddress") LIMIT 1),
  (SELECT "id" FROM "User" WHERE lower("walletAddress") = lower("Project"."publisherAddress") LIMIT 1)
);

UPDATE "Opportunity"
SET "publisherUserId" = (
  SELECT "publisherUserId" FROM "Project"
  WHERE "Project"."id" = "Opportunity"."projectId"
    AND lower("Project"."publisherAddress") = lower("Opportunity"."publisherAddress")
  LIMIT 1
);

UPDATE "Submission"
SET "contributorUserId" = COALESCE(
  (SELECT "userId" FROM "WalletLink" WHERE lower("address") = lower("Submission"."contributorAddress") LIMIT 1),
  (SELECT "id" FROM "User" WHERE lower("walletAddress") = lower("Submission"."contributorAddress") LIMIT 1)
);

CREATE INDEX "Project_publisherUserId_idx" ON "Project"("publisherUserId");
CREATE INDEX "Opportunity_publisherUserId_idx" ON "Opportunity"("publisherUserId");
CREATE INDEX "Submission_contributorUserId_idx" ON "Submission"("contributorUserId");
