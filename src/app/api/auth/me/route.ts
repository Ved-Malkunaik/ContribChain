import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("cc_wallet_session")?.value;
    const queryAddress = req.nextUrl.searchParams.get("address")?.toLowerCase();
    const targetAddress = queryAddress || sessionCookie;

    if (!targetAddress) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: targetAddress },
      include: {
        projects: {
          select: { id: true, name: true, repoId: true },
        },
        submissions: {
          select: { id: true, prUrl: true, status: true, isMerged: true, isRewardReady: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        githubUsername: user.githubUsername,
        githubId: user.githubId,
        isGitHubLinked: Boolean(user.githubId && user.githubUsername),
        projectCount: user.projects.length,
        submissionCount: user.submissions.length,
      },
    });
  } catch (error: any) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
