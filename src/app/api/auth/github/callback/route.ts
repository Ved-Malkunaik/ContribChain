import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = req.cookies.get("github_oauth_state")?.value;

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(
        new URL("/contributors?error=oauth_state_mismatch", req.url)
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/contributors?error=oauth_not_configured", req.url)
      );
    }

    // Exchange code for GitHub access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(`/contributors?error=${tokenData.error || "failed_token_exchange"}`, req.url)
      );
    }

    // Fetch user profile from GitHub API
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "ContribChain-App",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL("/contributors?error=failed_user_profile", req.url)
      );
    }

    const githubUser = await userResponse.json();
    const githubId = String(githubUser.id);
    const githubUsername = String(githubUser.login);

    // If an authenticated wallet session cookie exists, link them now
    const sessionWallet = req.cookies.get("cc_wallet_session")?.value;
    if (sessionWallet) {
      await prisma.user.upsert({
        where: { walletAddress: sessionWallet.toLowerCase() },
        update: {
          githubId,
          githubUsername,
        },
        create: {
          walletAddress: sessionWallet.toLowerCase(),
          githubId,
          githubUsername,
        },
      });
    }

    // Set a temporary cookie with verified GitHub credentials so frontend can prompt wallet signature
    const redirectUrl = new URL("/contributors", req.url);
    redirectUrl.searchParams.set("github_linked", "true");
    redirectUrl.searchParams.set("username", githubUsername);

    const res = NextResponse.redirect(redirectUrl.toString());
    res.cookies.set("verified_github_username", githubUsername, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
    res.cookies.set("verified_github_id", githubId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(`/contributors?error=${encodeURIComponent(error.message || "oauth_failed")}`, req.url)
    );
  }
}
