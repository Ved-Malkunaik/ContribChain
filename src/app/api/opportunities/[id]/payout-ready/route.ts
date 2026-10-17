import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        project: true,
        submissions: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (opportunity.state === "PAID") {
      return NextResponse.json({
        rewardReady: false,
        reason: "Opportunity escrow has already been paid out to the winner.",
        state: "PAID",
      });
    }

    if (opportunity.state === "REFUNDED") {
      return NextResponse.json({
        rewardReady: false,
        reason: "Opportunity was refunded to publisher after deadline expiry.",
        state: "REFUNDED",
      });
    }

    // Find the approved submission
    const approvedSubmission = opportunity.submissions.find(
      (s) => s.status === "APPROVED" || s.id === opportunity.selectedSubmissionId
    );

    if (!approvedSubmission) {
      return NextResponse.json({
        rewardReady: false,
        reason: "No winning submission has been approved yet by the publisher.",
        state: opportunity.state,
      });
    }

    // Fresh verification against GitHub REST API
    let isMerged = approvedSubmission.isMerged;
    let latestCommitSha = approvedSubmission.latestCommitSha;

    try {
      const headers: Record<string, string> = {
        "User-Agent": "ContribChain-PayoutCheck",
        Accept: "application/vnd.github.v3+json",
      };
      if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        headers["Authorization"] = `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`;
      }

      const ghRes = await fetch(
        `https://api.github.com/repos/${approvedSubmission.repoOwner}/${approvedSubmission.repoName}/pulls/${approvedSubmission.prNumber}`,
        { headers }
      );

      if (ghRes.ok) {
        const ghData = await ghRes.json();
        isMerged = Boolean(ghData.merged);
        latestCommitSha = ghData.head?.sha || latestCommitSha;

        // Sync with SQLite DB
        await prisma.submission.update({
          where: { id: approvedSubmission.id },
          data: {
            isMerged,
            latestCommitSha,
            isRewardReady: isMerged,
          },
        });
      }
    } catch (apiErr) {
      console.warn("Could not reach GitHub API for live merge check:", apiErr);
    }

    if (!isMerged) {
      return NextResponse.json({
        rewardReady: false,
        reason: "Submission is approved on ContribChain, but the Pull Request has not been merged on GitHub yet. Payout unlocks once merged.",
        submission: approvedSubmission,
      });
    }

    return NextResponse.json({
      rewardReady: true,
      message: "Contribution is approved and Pull Request is confirmed merged on GitHub. Ready for on-chain payout confirmation.",
      submission: {
        id: approvedSubmission.id,
        onChainId: approvedSubmission.onChainId,
        contributorAddress: approvedSubmission.contributorAddress,
        prUrl: approvedSubmission.prUrl,
        prNumber: approvedSubmission.prNumber,
        isMerged: true,
      },
      payoutAmountEth: opportunity.rewardEth,
      payoutAmountWei: opportunity.rewardWei,
    });
  } catch (error: any) {
    console.error("Payout readiness check error:", error);
    return NextResponse.json({ error: error.message || "Failed to check payout readiness" }, { status: 500 });
  }
}
