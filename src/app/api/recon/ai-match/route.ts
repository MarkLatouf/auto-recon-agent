/**
 * POST /api/recon/ai-match
 *
 * Browser sends the current unmatched line ids. This route (Node, not the
 * browser) calls Gemini + Supabase so GEMINI_API_KEY never reaches the client.
 */

import { NextResponse } from "next/server";
import { runAiMatch } from "@/lib/recon/aiMatching";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      unmatchedBankIds?: string[];
      unmatchedLedgerIds?: string[];
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const pairs = await runAiMatch({
      sessionId: body.sessionId,
      unmatchedBankIds: body.unmatchedBankIds ?? [],
      unmatchedLedgerIds: body.unmatchedLedgerIds ?? [],
    });

    return NextResponse.json({ pairs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI match failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
