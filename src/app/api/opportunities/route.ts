import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { parseEther } from "viem";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const publisher = searchParams.get("publisher")?.toLowerCase();
    const state = searchParams.get("state");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (publisher) where.publisherAddress = publisher;
    if (state) where.state = state;

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, repoId: true, repoUrl: true, liveDappUrl: true },
        },
        submissions: {
          select: { id: true, contributorAddress: true, prUrl: true, status: true, isMerged: true, isRewardReady: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ opportunities });
  } catch (error: any) {
    console.error("Fetch opportunities error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch opportunities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      publisherAddress,
      title,
      taskType,
      description,
      acceptanceCriteria,
      difficulty,
      requiredSkills,
      rewardEth,
      deadline,
      issueUrl,
      onChainId,
      txHash,
    } = body;

    if (!projectId || !publisherAddress || !title || !description || !acceptanceCriteria || !rewardEth || !deadline) {
      return NextResponse.json({ error: "Missing required opportunity fields" }, { status: 400 });
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return NextResponse.json({ error: "Deadline must be in the future" }, { status: 400 });
    }

    const rewardWei = parseEther(String(rewardEth)).toString();

    // Canonical metadata hashing
    const canonicalPayload = JSON.stringify({
      projectId,
      title,
      taskType,
      description,
      acceptanceCriteria,
      difficulty,
      requiredSkills,
      rewardEth,
      rewardWei,
      deadline: deadlineDate.toISOString(),
      publisher: publisherAddress.toLowerCase(),
    });
    const metadataHash = `0x${crypto.createHash("sha256").update(canonicalPayload).digest("hex")}`;
    const metadataURI = `app://metadata/opportunity/${crypto.randomBytes(8).toString("hex")}`;

    const opportunity = await prisma.opportunity.create({
      data: {
        projectId,
        publisherAddress: publisherAddress.toLowerCase(),
        title,
        taskType: taskType || "feature",
        description,
        acceptanceCriteria,
        difficulty: difficulty || "Intermediate",
        requiredSkills: Array.isArray(requiredSkills) ? JSON.stringify(requiredSkills) : String(requiredSkills || "[]"),
        rewardEth: String(rewardEth),
        rewardWei,
        deadline: deadlineDate,
        issueUrl: issueUrl || null,
        metadataURI,
        metadataHash,
        state: "OPEN",
        onChainId: onChainId ? Number(onChainId) : null,
        txHash: txHash || null,
      },
    });

    return NextResponse.json({
      success: true,
      opportunity,
      metadataURI,
      metadataHash,
      rewardWei,
      deadlineEpochSeconds: Math.floor(deadlineDate.getTime() / 1000),
    });
  } catch (error: any) {
    console.error("Create opportunity error:", error);
    return NextResponse.json({ error: error.message || "Failed to create opportunity" }, { status: 500 });
  }
}
