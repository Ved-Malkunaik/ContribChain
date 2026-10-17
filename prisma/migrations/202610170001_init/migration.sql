-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "wallet" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WalletLink" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "repoId" TEXT,
    "parentId" TEXT,
    "chainRef" TEXT,
    "transactionHash" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VerifiedSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "prState" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL,
    "nextSyncAt" DATETIME NOT NULL,
    "syncError" TEXT,
    "transactionHash" TEXT,
    "chainRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "block" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockNumber" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Challenge_sessionId_idx" ON "Challenge"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_hash_key" ON "Snapshot"("hash");

-- CreateIndex
CREATE INDEX "Snapshot_kind_published_idx" ON "Snapshot"("kind", "published");

-- CreateIndex
CREATE INDEX "VerifiedSubmission_repoId_prNumber_idx" ON "VerifiedSubmission"("repoId", "prNumber");

-- CreateIndex
CREATE INDEX "VerifiedSubmission_opportunityId_wallet_idx" ON "VerifiedSubmission"("opportunityId", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_chainId_transactionHash_logIndex_key" ON "ChainEvent"("chainId", "transactionHash", "logIndex");

