import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }
  await getTokensFromCode(code);
  return NextResponse.redirect(new URL("/triage", request.url));
}
