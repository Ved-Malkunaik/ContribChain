import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMessage } from "viem";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, signature, message, githubUsername, githubId } = body;

    if (!walletAddress || !signature || !message) {
      return NextResponse.json({ error: "walletAddress, signature, and message are required" }, { status: 400 });
    }

    const cleanAddress = walletAddress.toLowerCase();

    // Fetch user challenge from database
    const user = await prisma.user.findUnique({
      where: { walletAddress: cleanAddress },
    });

    if (!user || !user.nonce) {
      return NextResponse.json({ error: "No active challenge nonce found. Request a new nonce first." }, { status: 400 });
    }

    if (user.nonceExpiresAt && user.nonceExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Authentication challenge expired. Request a new nonce." }, { status: 400 });
    }

    if (!message.includes(user.nonce)) {
      return NextResponse.json({ error: "Challenge nonce mismatch in signed message." }, { status: 400 });
    }

    // Cryptographic verification with Viem
    const isSignatureValid = await verifyMessage({
      address: cleanAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isSignatureValid) {
      return NextResponse.json({ error: "Cryptographic signature verification failed." }, { status: 401 });
    }

    // Invalidate nonce immediately (single-use)
    const updatedUser = await prisma.user.update({
      where: { walletAddress: cleanAddress },
      data: {
        nonce: null,
        nonceExpiresAt: null,
        ...(githubId ? { githubId: String(githubId) } : {}),
        ...(githubUsername ? { githubUsername: String(githubUsername) } : {}),
      },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        walletAddress: updatedUser.walletAddress,
        githubUsername: updatedUser.githubUsername,
        githubId: updatedUser.githubId,
      },
    });

    // Set secure HTTP-only cookie with wallet session
    response.cookies.set("cc_wallet_session", cleanAddress, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Signature verification error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify signature" }, { status: 500 });
  }
}
