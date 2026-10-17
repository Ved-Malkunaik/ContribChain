ALTER TABLE "Snapshot" ADD COLUMN "chainAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VerifiedSubmission" ADD COLUMN "chainAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChainEvent" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Transaction" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT '';
