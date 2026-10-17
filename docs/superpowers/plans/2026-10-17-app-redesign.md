# ContribChain App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Apply the existing landing page's monochrome, dot-matrix, rounded-pill visual language to the full local dApp, and make confirmed lifecycle actions unambiguous.

**Architecture:** Shared CSS tokens and small presentation components style the existing routes. Preserve wallet, receipt, demo mode, feed, escrow, and payout behavior. Route groups can be restyled independently against shared class names.

**Tech Stack:** Existing Next 16.4.2, React 19, Tailwind, lucide-react, wagmi and viem; no new packages.

**Spec:** User-requested redesign using the current landing page as the reference. Black backgrounds, neutral translucent surfaces, white pill CTAs, dotted display headings, generous spacing, restrained status colors. Keep the landing video and brand.

## Global Constraints
- Read relevant installed Next docs before code changes.
- Keep all real transaction and simulation boundaries unchanged.
- Demo identity/merge must remain visibly marked; payments remain real Sepolia.
- Paid submissions must never expose Approve or Reject; Approved submissions point to payment; Paid shows receipt.
- No new blockchain transactions or deployment actions.
- Local workspace is not a Git checkout; do not create commits/worktrees.

## Review Focus
- Pending, Approved, Paid and Rejected have appropriate actions and distinct labels.
- Narrow mobile layouts must not overflow forms, navigation, tabs or wallet controls.
- Disconnected wallets receive usable empty states instead of misleading zero activity.
- Async loading/error/recovery feedback remains visible and accessible.
- Existing real-chain data and publisher/contributor account filters are preserved.

### Task 1: Shared visual system and chrome (parent)
- [x] Add presentation components and shared CSS classes for page headers, surfaces, buttons, forms, pills, metrics, empty states and transaction feedback.
- [x] Refine Navbar, Footer, wallet dialog and landing workflow to use the same neutral styling.
- [x] Restyle IdentityPanel, FeedStatus, TransactionStatus, SubmissionProgress and PublisherActions.

### Task 2: Public discovery and detail routes (public-route agent)
- [x] Restyle Explore, project details and opportunity details using shared classes.
- [x] Preserve search, filtering, links, live contract state, wallet gate and demo submission controls.
- [x] Verify scoped lint and route render.

### Task 3: Dashboards, forms and lifecycle controls (workspace-route agent)
- [x] Restyle Publisher Hub, Contributors Hub, project registration and opportunity registration.
- [x] Add a tested submission lifecycle presentation helper; assert Paid cannot review/pay again and Approved directs to payout.
- [x] Render paid confirmation and transaction receipt instead of stale Approve/Reject actions.
- [x] Verify scoped lint and lifecycle tests.

### Task 4: Integration and browser QA (parent)
- [x] Run full tests and scoped lint; inspect production typecheck without changing unrelated legacy endpoints.
- [x] Inspect representative desktop/mobile discovery, detail, dashboard and form screens.
- [x] Confirm deployed Paid state and save final screenshots.

Validation: 27/27 tests passed. Changed UI files passed ESLint. Desktop and 390px mobile layouts inspected. Existing Prisma user-schema errors remain in untouched legacy API routes; full-project typecheck/lint are not clean. Review findings for expiry guards and scoped recovered confirmations were fixed and re-reviewed with no blockers.
