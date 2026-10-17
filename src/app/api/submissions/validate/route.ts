import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PR_URL_REGEX = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, prUrl, contributorAddress, notes } = body;

    if (!opportunityId || !prUrl || !contributorAddress) {
      return NextResponse.json({ error: "opportunityId, prUrl, and contributorAddress are required" }, { status: 400 });
    }

    const cleanAddress = contributorAddress.toLowerCase();

    // 1. Verify PR URL format
    const match = prUrl.trim().match(PR_URL_REGEX);
    if (!match) {
      return NextResponse.json({
        error: "Invalid PR URL. Format must be: https://github.com/{owner}/{repo}/pull/{number}",
      }, { status: 400 });
    }

    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);
    const repoFullName = `${owner}/${repo}`.toLowerCase();

    // 2. Fetch target opportunity and project from DB
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { project: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // 3. Verify opportunity state and deadline
    if (opportunity.state !== "OPEN") {
      return NextResponse.json({ error: `Opportunity is not open (Current state: ${opportunity.state})` }, { status: 400 });
    }

    if (new Date() >= opportunity.deadline) {
      return NextResponse.json({ error: "Opportunity submission deadline has passed" }, { status: 400 });
    }

    // 4. Verify base repository matches project registered repo
    const registeredRepo = opportunity.project.repoId.toLowerCase();
    if (repoFullName !== registeredRepo) {
      return NextResponse.json({
        error: `PR repository (${repoFullName}) does not match the project's registered repository (${registeredRepo})`,
      }, { status: 400 });
    }

    // 5. Check if user has already submitted this exact PR
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        opportunityId,
        contributorAddress: cleanAddress,
        prUrl: prUrl.trim(),
      },
    });

    if (existingSubmission) {
      return NextResponse.json({ error: "You have already submitted this Pull Request URL for this opportunity" }, { status: 400 });
    }

    // 6. Fetch author info from GitHub API (if token available or public API)
    let githubUsername: string | null = null;
    let githubUserId: string | null = null;
    let isMerged = false;
    let latestCommitSha: string | null = null;

    try {
      const headers: Record<string, string> = {
        "User-Agent": "ContribChain-Validation",
        Accept: "application/vnd.github.v3+json",
      };
      if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        headers["Authorization"] = `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`;
      }

      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        githubUsername = ghData.user?.login || null;
        githubUserId = ghData.user?.id ? String(ghData.user.id) : null;
        isMerged = Boolean(ghData.merged);
        latestCommitSha = ghData.head?.sha || null;
      }
    } catch (apiErr) {
      console.warn("Could not fetch PR from GitHub API directly (continuing with client details):", apiErr);
    }

    // 7. Check contributor wallet's linked GitHub account
    const user = await prisma.user.findUnique({
      where: { walletAddress: cleanAddress },
    });

    if (user?.githubId && githubUserId && user.githubId !== githubUserId) {
      return NextResponse.json({
        error: `PR author on GitHub (@${githubUsername}) does not match your linked GitHub account (@${user.githubUsername}). You can only submit your own Pull Requests.`,
      }, { status: 403 });
    }

    // 8. Persist validated submission record
    const submission = await prisma.submission.create({
      data: {
        opportunityId,
        contributorAddress: cleanAddress,
        githubUsername: githubUsername || user?.githubUsername || null,
        githubUserId: githubUserId || user?.githubId || null,
        prUrl: prUrl.trim(),
        prNumber,
        repoOwner: owner,
        repoName: repo,
        notes: notes ? String(notes) : null,
        status: "PENDING",
        isMerged,
        latestCommitSha,
      },
    });

    return NextResponse.json({
      valid: true,
      submission,
      message: "PR verified successfully. Proceed with MetaMask on-chain submission.",
    });
  } catch (error: any) {
    console.error("Submission validation error:", error);
    return NextResponse.json({ error: error.message || "Failed to validate submission" }, { status: 500 });
  }
}
