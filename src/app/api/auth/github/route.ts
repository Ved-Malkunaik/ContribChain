import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/github/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  if (!clientId) {
    return NextResponse.json({
      configured: false,
      message: "GITHUB_CLIENT_ID is not configured in .env. Create an OAuth app at https://github.com/settings/developers and set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      demoNote: "For local offline testing, you can link an author identity directly using the wallet challenge flow.",
    }, { status: 503 });
  }

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", clientId);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", "read:user");
  githubAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(githubAuthUrl.toString());
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60, // 10 minutes
    path: "/",
  });

  return response;
}
