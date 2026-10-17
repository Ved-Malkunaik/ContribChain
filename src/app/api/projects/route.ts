import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publisher = searchParams.get("publisher")?.toLowerCase();
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};
    if (publisher) {
      where.publisherAddress = publisher;
    }
    if (category && category !== "All") {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { shortDescription: { contains: search } },
        { repoId: { contains: search } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        opportunities: {
          select: {
            id: true,
            title: true,
            rewardEth: true,
            state: true,
            deadline: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("Fetch projects error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      publisherAddress,
      name,
      shortDescription,
      detailedDescription,
      category,
      technologies,
      repoUrl,
      liveDappUrl,
      demoVideoUrl,
      onChainId,
      txHash,
    } = body;

    // Required field validation
    if (!publisherAddress || !name || !shortDescription || !detailedDescription || !category || !repoUrl || !liveDappUrl) {
      return NextResponse.json({ error: "All required project fields must be provided" }, { status: 400 });
    }

    // Extract repoId from GitHub repo URL
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoMatch) {
      return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 });
    }
    const repoId = `${repoMatch[1]}/${repoMatch[2].replace(/\.git$/, "")}`;

    // Canonical metadata hashing
    const canonicalPayload = JSON.stringify({
      name,
      shortDescription,
      detailedDescription,
      category,
      technologies,
      repoId,
      repoUrl,
      liveDappUrl,
      publisher: publisherAddress.toLowerCase(),
    });
    const metadataHash = `0x${crypto.createHash("sha256").update(canonicalPayload).digest("hex")}`;
    const metadataURI = `app://metadata/project/${crypto.randomBytes(8).toString("hex")}`;

    const project = await prisma.project.create({
      data: {
        publisherAddress: publisherAddress.toLowerCase(),
        name,
        shortDescription,
        detailedDescription,
        category,
        technologies: Array.isArray(technologies) ? JSON.stringify(technologies) : String(technologies),
        repoId,
        repoUrl,
        liveDappUrl,
        demoVideoUrl: demoVideoUrl || null,
        metadataURI,
        metadataHash,
        onChainId: onChainId ? Number(onChainId) : null,
        txHash: txHash || null,
      },
    });

    return NextResponse.json({
      success: true,
      project,
      metadataURI,
      metadataHash,
    });
  } catch (error: any) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: error.message || "Failed to create project" }, { status: 500 });
  }
}
