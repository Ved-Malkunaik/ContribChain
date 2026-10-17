import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json({ error: "Missing or invalid walletAddress" }, { status: 400 });
    }

    const cleanAddress = walletAddress.toLowerCase();
    const nonce = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.user.upsert({
      where: { walletAddress: cleanAddress },
      update: {
        nonce,
        nonceExpiresAt: expiresAt,
      },
      create: {
        walletAddress: cleanAddress,
        nonce,
        nonceExpiresAt: expiresAt,
      },
    });

    const chainId = process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_ID || "11155111";
    const domain = "contribchain.local";
    const issuedAt = new Date().toISOString();

    const statement = `Sign this message to authenticate your wallet with ContribChain.\n\nDomain: ${domain}\nAddress: ${cleanAddress}\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

    return NextResponse.json({
      nonce,
      statement,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Error generating nonce:", error);
    return NextResponse.json({ error: error.message || "Failed to generate nonce" }, { status: 500 });
  }
}
