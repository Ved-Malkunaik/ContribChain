# ContribChain

## Local setup

Publisher and contributor actions use the connected wallet. GitHub linking is optional: publishers can register public repositories and contributors can submit public PR URLs for status tracking. If a contributor does not link GitHub, the publisher must review the PR author and work before approving the reward.

1. Connect BridgeKey or another wallet on MST Testnet. GitHub OAuth is optional.
2. A publisher registers a public GitHub repository, then creates and funds an opportunity.
3. A contributor connects a wallet, submits a public PR URL for the registered repository, and confirms the on-chain submission.
4. ContribChain tracks the public PR state. After it is merged and the publisher approves the contribution, the publisher releases the escrow reward. For unlinked GitHub authors, publisher approval includes manual author/work review.

Confirmed MetaMask smart-account transactions are supported through the DelegationManager execution envelope. Reloading the app automatically checks a stored pending transaction instead of requiring another payment.

Sepolia contribution bounties: funded escrow, verified GitHub authors, publisher review, merge checks and publisher-confirmed payment. The existing dark layout/video hero are preserved. Live routes no longer use fixture bounties, fabricated statistics or timer-based transaction success.

**Implemented and locally tested:** contract, wallet/contract frontend wiring, Prisma SQLite, GitHub OAuth routes, wallet ownership challenges, PR validation, signed webhooks, merge gate, canonical receipt ingestion, bounded event indexing, and linked GitHub/wallet profile checks. **Pending live verification:** BridgeKey interaction, GitHub OAuth/real PRs, public webhook delivery, and live MST Testnet transactions.

## Prerequisites and setup

Use Node **24.x** (tested: 24.11.1, npm 11.6.2), MetaMask, two funded Sepolia test accounts, a public repository owned by the publisher's GitHub User, a separate contributor GitHub account, GitHub sign-in credentials, a Sepolia RPC and an HTTPS webhook endpoint. Keep sibling `contracts` and `contribchain` directories together.

```powershell
# Start in contribchain
Set-Location '..\contracts'
npm ci
npm run compile
npm test
npm run export
Set-Location '..\contribchain'
npm ci
Copy-Item .env.example .env # Fresh checkout only; preserve an existing .env
npm run db:generate
npm run db:deploy
npm run dev
```

Open **http://localhost:3000**. The existing Windows dev server was reachable through localhost; `127.0.0.1:3000` was unavailable in this session. Use the actual bound address and set `APP_URL` to exactly that origin. For another port, use `npm run dev -- --port 3100` and update APP_URL/OAuth callback. Do not run two dev servers against the same `.next` directory.

Browsing works without credentials. Until configured, Explore explicitly says deployment is missing and shows no funded fixtures. A local `.env` with blank integration credentials was initialized; it is excluded from Git and the source archive.

Production commands, on a machine with persistent writable storage:

```powershell
npm run db:generate
npm run db:deploy
npm run build
npm run start
```

## Configuration

`.env.example` describes each field:

- `DATABASE_URL`: persistent SQLite file, relative to the Prisma schema or an absolute file URL. CLI and server must use the same database.
- `APP_URL`: exact browser/public origin, including port. Set `NEXT_PUBLIC_APP_URL` to the same origin. Choose a stable origin before publishing metadata: on-chain metadata URIs cannot be changed.
- `AUTH_SECRET`: generate locally using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in `.env`.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: server-only OAuth credentials from a GitHub OAuth App, or the OAuth Client ID and Client Secret from a GitHub App. For a GitHub App, do not use its numeric App ID or private key for these values.
- `GITHUB_WEBHOOK_SECRET`: independently generated secret shared with the repository webhook.
- `GITHUB_API_TOKEN`: optional server-only public-API token for higher rate limits; repository write permission is unnecessary.
- `SEPOLIA_RPC_URL`: server RPC; may contain a secret. `NEXT_PUBLIC_SEPOLIA_RPC_URL` is browser-visible and must not contain private credentials.
- `NEXT_PUBLIC_BOUNTY_ADDRESS`, `NEXT_PUBLIC_BOUNTY_DEPLOYMENT_BLOCK`: actual Sepolia deployment values. Empty values intentionally disable writes.

Restart development, or rebuild/restart production, after changing public configuration. The generated ABI is `src/lib/generated/bounty-abi.ts`; JSON ABI and bytecode are in `../contracts`.

Read **`../contracts/REMIX.md`** for Solidity **0.8.28**, optimizer **200**, **Paris** EVM, the version-pinned Remix source, test accounts, Value units, Sepolia deployment and explorer checks. Deploy with MetaMask. No seed phrase or personal private key is required in any file or command.

## GitHub OAuth and wallet ownership

1. GitHub linking is optional. To enable it, configure a GitHub OAuth App or GitHub App and set its callback URL to `APP_URL/api/auth/callback/github`. For a GitHub App, use its OAuth Client ID and Client Secret; the numeric App ID and private key are not used for sign-in.
2. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `AUTH_SECRET` in the server environment if you want to offer GitHub linking. Public repository and PR tracking works from submitted URLs without contributor OAuth.
3. Wallet transactions are signed in the connected wallet. A GitHub account link can additionally verify that the wallet belongs to the PR author. Without that link, publisher approval is the manual review checkpoint.

Only public repositories are supported. OAuth tokens remain in the server database and are never returned to frontend session/feed APIs. Protect database files and backups.

## Webhooks and near-real-time synchronization

For local HTTPS testing, install Cloudflare's official cloudflared distribution and run:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Set APP_URL and OAuth homepage/callback to the generated HTTPS origin, restart Next, and use that HTTPS address for login. Quick tunnel hostnames are temporary; use a stable named tunnel or hosted origin for durable metadata.

Repository Settings → Webhooks → Add webhook: URL **`https://YOUR-HOST/api/webhooks/github`**, `application/json`, secret matching GITHUB_WEBHOOK_SECRET, SSL verification enabled, individual event **Pull requests**.

The endpoint verifies raw-body HMAC SHA-256 using constant-time comparison and deduplicates deliveries. Opened/synchronize/reopened/closed events trigger authoritative REST refreshes. Payload state is not blindly applied, so delayed closed-unmerged events cannot regress a merged PR. Failed refreshes return 503 and remain retryable through redelivery or polling/manual refresh.

UI refresh is approximately **15 seconds**, with a shared server/database cache, concurrent refresh deduplication, rate-limit backoff and visible stale/error status. This is near-real-time, not an instant guarantee. Payout performs a fresh server check. A GitHub failure cannot produce Reward ready.

## Manual final demonstration — pending

1. Publisher connects a wallet and registers a public repository with a required live dApp URL.
2. Create an opportunity with acceptance criteria, skills, positive ETH reward and deadline. Review actual estimated gas and refund policy before MetaMask confirmation. Reward has at most 18 decimal places and the deposit must exactly match integer wei.
3. Contributor sees the funded opportunity, connects a wallet, opens a real PR and submits its URL. The backend verifies the public PR and its base repository, then the contributor confirms the on-chain submission.
4. Publisher approves the winner on-chain **before expiry**. Review, GitHub state and payment are shown separately. Approval fixes the contributor and cannot be refunded.
5. Merge the exact PR on GitHub. Check last sync/latest head commit, use manual refresh if needed, then wait for Reward ready. Closed-unmerged PRs must not qualify.
6. Choose “Confirm and pay.” Backend rechecks contract winner, canonical receipt, repository and fresh merge state. The publisher manually reviews unlinked authors. Browser simulates, then MetaMask requests confirmation. **Value = zero:** escrow supplies the bounty; publisher supplies gas only.
7. Wait for a successful receipt and two confirmations. Check recipient, exact amount and explorer link in both dashboards. Refresh; data persists. A second release must fail.
8. Reject another submission and verify its opportunity stays Open. Use Remix VM with a short deadline to demonstrate a valid expired refund; normal app deadlines are 1–365 days.
9. Check rejection, wrong chain, insufficient gas, RPC outage, reverted receipt, speed-up/cancel and reload. Pending intent includes wallet, target, calldata, amount, sent block and observed nonce. Use the recovery panel after reload. If the original hash was dropped while closed, paste the replacement hash from MetaMask/Etherscan. Only a matching intended transaction can confirm success; changed/cancelled actions cannot.

## Data and trust boundaries

Contract state is authoritative for ownership, escrow, approval, winner, payments and refunds. GitHub is authoritative for PR state. SQLite holds sessions, identity links, challenges, immutable metadata, verified PRs, transaction references, webhook deliveries and event checkpoints.

Canonical metadata recursively sorts object keys with JavaScript `Object.keys(...).sort()`, preserves array order, encodes finite JSON values with JSON.stringify, and hashes the exact UTF-8 bytes with Keccak-256. Snapshot version/UUID distinguish drafts. Served content is identical to the hashed content; there is no endpoint silently editing funded criteria.

Publication and payment require canonical successful receipts/current contract reads; browser claims such as paid=true are never trusted. Drafts survive failed/abandoned transactions. Direct receipt ingestion works independently of the indexing cursor. Events recover from deployment block in up to five 2,000-block ranges per sync, overlap 12 recent blocks for reorg checks, and deduplicate by chain/transaction/log index. Records are scoped to the configured deployment. Two confirmations are not finality; deeper reorganizations require operator reindexing.

**The contract does not verify GitHub. Direct contract calls bypass application-level GitHub checks. Publisher confirmation is trusted; this is not a fully trustless or independently attested merge oracle.** Approval does not guarantee prompt payment: publisher must release. No dispute/abandonment mechanism exists. Approved rewards remain payable after expiry and cannot be refunded. Pending submissions do not prevent refund without an approved winner.

## Verification

```powershell
# contracts
npm test
npm run compile
npm run export
# contribchain
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Executed locally: **23 contract tests** and **12 application tests** passed. The app suite includes real local EVM + SQLite + route-handler payout, exact 0.010000000000000001 ETH, persisted payments after database reconnect, unauthorized PR author, GitHub failure, rejection, refund, webhook deduplication/out-of-order state, deployment isolation, signature/session/replay/expiry checks and replacement-intent validation. GitHub REST responses in the local integration test are isolated fixtures. These do not prove live OAuth/GitHub/MetaMask/Sepolia operation. The test-only Node SQLite API emits an experimental notice.

## Known limits and hosting

- Testnet/hackathon implementation; focused source review is not an independent smart-contract security audit. Do not use for mainnet funds.
- Dependency audit still reports transitive advisories; critical Auth.js adapter/core exposure was updated. Remaining dependency advisories need review before production. Avoid blind major-version audit fixes to the established stack.
- Feed caps: 200 metadata snapshots, 500 submission events, 100 history rows. Active requests drive bounded chain catch-up. Production needs pagination/background indexing and broader abuse controls.
- Recovery requires the original browser's pending intent; if browser storage is lost, chain events remain authoritative but an unbound PR needs manual reconciliation. Direct unverified submissions never receive a false verified label.
- SQLite must live on persistent writable storage. Use one long-running Node 24 process on a VM with persistent disk, TLS reverse proxy, restricted host headers, protected `.env`/database files and backups. Set DATABASE_URL to that volume and APP_URL to public HTTPS. **Do not use this SQLite configuration on ephemeral serverless hosting.** Multiple instances/serverless require explicit migration to hosted PostgreSQL and shared synchronization state.
- Localhost/temporary-tunnel metadata URLs are not durable decentralized storage. Use a stable public origin before publishing data for others.
- Standalone `../index.html` template and earlier `../mergeMint` prototype are untouched.

Future work documented only: contract-verifiable GitHub attestations with signer trust, disputes/abandonment and contributor claim/timeout policies, organization GitHub App installs, ERC-20 rewards, multiple winners/milestones, decentralized metadata, reputation/notifications, production database/indexer and independent security review.

## Official references

[Next route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), installed Next 16.4.2 docs under node_modules/next/dist/docs, [OpenZeppelin guard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard), [Hardhat 2](https://v2.hardhat.org/), [Auth.js core](https://authjs.dev/reference/core), [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [webhook signatures](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [Prisma v6 migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started), [Cloudflare tunnels](https://developers.cloudflare.com/tunnel/get-started/).
