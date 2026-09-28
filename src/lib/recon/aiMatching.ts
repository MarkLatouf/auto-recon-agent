/**
 * Tier 3 AI matching — semantic pairs via Gemini embeddings.
 *
 * This module is imported only from the API route (`src/app/api/recon/ai-match`).
 * The Gemini key stays on the server; the browser never sees it.
 *
 * Pipeline:
 * 1. Load unmatched bank/ledger rows for this session.
 * 2. If a row has no `embedding` yet, call Gemini and UPDATE the row.
 * 3. Compare every remaining bank vector to every remaining ledger vector
 *    with cosine similarity; keep pairs at or above 0.85.
 * 4. Greedy one-to-one: highest score first, each line used at most once.
 */

import { daysBetween, toIsoDate } from "@/lib/recon/matching";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CsvRow, MatchedPair, ReconLine } from "@/lib/types";

const SIMILARITY_THRESHOLD = 0.85;
/** Native 768-d Gemini embedding model. */
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONS = 768;
const BATCH_SIZE = 50;

export type LineWithEmbedding = ReconLine & {
  embedding: number[] | null;
};

type LineRow = {
  id: string;
  session_id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | string | null;
  raw_data: CsvRow | null;
  embedding: unknown;
};

function toReconLine(row: LineRow, source: ReconLine["source"]): LineWithEmbedding {
  return {
    id: row.id,
    session_id: row.session_id,
    transaction_date: row.transaction_date,
    description: row.description,
    amount: row.amount === null ? null : Number(row.amount),
    raw_data: row.raw_data,
    source,
    embedding: parseEmbedding(row.embedding),
  };
}

/**
 * pgvector can arrive as a JS number[], a Postgres literal "[0.1,0.2]",
 * or null. Normalize to number[] so cosine math is always the same shape.
 */
export function parseEmbedding(value: unknown): number[] | null {
  if (value == null) return null;
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return value.length === EMBED_DIMENSIONS ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\[/, "").replace(/\]$/, "");
    if (!trimmed) return null;
    const nums = trimmed.split(",").map((part) => Number(part.trim()));
    if (nums.some((n) => Number.isNaN(n)) || nums.length !== EMBED_DIMENSIONS) return null;
    return nums;
  }
  return null;
}

/** Text we send to Gemini: what the line “means”, not the raw CSV. */
export function lineToEmbedText(line: ReconLine): string {
  const description = line.description?.trim() || "no description";
  const amount = line.amount === null ? "unknown amount" : `amount ${line.amount}`;
  return `${description}; ${amount}`;
}

/**
 * Cosine similarity: how aligned two vectors are, ignoring their length.
 *
 *   cos(θ) = (A · B) / (||A|| × ||B||)
 *
 * - Dot product A · B = sum of A[i] * B[i]
 * - ||A|| is the Euclidean length (sqrt of sum of squares)
 * - Result is between -1 and 1. For embeddings, “same meaning” is near 1.
 *
 * We skip a pair if either vector is missing or has length 0 (divide-by-zero).
 */
export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return null;
  return dot / denom;
}

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY. Add it to .env.local and restart npm run dev.");
  }
  return key;
}

/**
 * One Gemini HTTP call can embed many strings (batchEmbedContents).
 * We ask for 768 dimensions so the vector matches the Postgres `vector(768)` column.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const key = geminiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${encodeURIComponent(key)}`;

  const body = {
    requests: texts.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIMENSIONS,
      taskType: "SEMANTIC_SIMILARITY",
    })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    embeddings?: { values?: number[] }[];
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini embedding failed (${response.status})`);
  }

  const vectors = payload.embeddings?.map((item) => item.values ?? []) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error("Gemini returned a different number of embeddings than we sent.");
  }
  return vectors;
}

async function loadLines(
  table: "bank_lines" | "ledger_lines",
  sessionId: string,
  ids: string[],
  source: ReconLine["source"],
): Promise<LineWithEmbedding[]> {
  if (ids.length === 0) return [];
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from(table)
    .select("id, session_id, transaction_date, description, amount, raw_data, embedding")
    .eq("session_id", sessionId)
    .in("id", ids);

  if (error) {
    throw new Error(`Could not load unmatched ${table}: ${error.message}`);
  }

  return ((data ?? []) as LineRow[]).map((row) => toReconLine(row, source));
}

async function saveEmbedding(
  table: "bank_lines" | "ledger_lines",
  id: string,
  embedding: number[],
): Promise<void> {
  const supabase = createServerSupabase();
  const first = await supabase.from(table).update({ embedding }).eq("id", id);
  if (!first.error) return;

  // Some PostgREST/pgvector setups want the literal string "[0.1,0.2,...]".
  const asLiteral = `[${embedding.join(",")}]`;
  const second = await supabase.from(table).update({ embedding: asLiteral }).eq("id", id);
  if (second.error) {
    throw new Error(`Could not save embedding on ${table}: ${first.error.message}`);
  }
}

async function fillMissingEmbeddings(
  table: "bank_lines" | "ledger_lines",
  lines: LineWithEmbedding[],
): Promise<LineWithEmbedding[]> {
  const missing = lines.filter((line) => !line.embedding);
  const updated = [...lines];

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const vectors = await embedTexts(chunk.map(lineToEmbedText));

    await Promise.all(
      chunk.map(async (line, index) => {
        const embedding = vectors[index];
        if (!embedding || embedding.length !== EMBED_DIMENSIONS) {
          throw new Error(`Gemini returned a vector that is not ${EMBED_DIMENSIONS}-dimensional.`);
        }
        await saveEmbedding(table, line.id, embedding);
        const slot = updated.findIndex((row) => row.id === line.id);
        if (slot >= 0) {
          updated[slot] = { ...updated[slot]!, embedding };
        }
      }),
    );
  }

  return updated;
}

function pairBySimilarity(
  bankLines: LineWithEmbedding[],
  ledgerLines: LineWithEmbedding[],
): MatchedPair[] {
  type Candidate = { bank: LineWithEmbedding; ledger: LineWithEmbedding; score: number };
  const candidates: Candidate[] = [];

  // Nested loop: every unmatched bank vs every unmatched ledger.
  for (const bank of bankLines) {
    if (!bank.embedding) continue;
    for (const ledger of ledgerLines) {
      if (!ledger.embedding) continue;
      const score = cosineSimilarity(bank.embedding, ledger.embedding);
      if (score === null || score < SIMILARITY_THRESHOLD) continue;
      candidates.push({ bank, ledger, score });
    }
  }

  // Highest similarity first so a strong pair is not stolen by a weaker one.
  candidates.sort((a, b) => b.score - a.score);

  const usedBank = new Set<string>();
  const usedLedger = new Set<string>();
  const pairs: MatchedPair[] = [];

  for (const candidate of candidates) {
    if (usedBank.has(candidate.bank.id) || usedLedger.has(candidate.ledger.id)) continue;
    usedBank.add(candidate.bank.id);
    usedLedger.add(candidate.ledger.id);

    const bankDate = toIsoDate(candidate.bank.transaction_date);
    const ledgerDate = toIsoDate(candidate.ledger.transaction_date);

    const { embedding: _bankEmb, ...bank } = candidate.bank;
    const { embedding: _ledgerEmb, ...ledger } = candidate.ledger;

    pairs.push({
      bank,
      ledger,
      tier: 3,
      dateDiffDays: bankDate && ledgerDate ? daysBetween(bankDate, ledgerDate) : 0,
      similarity: candidate.score,
    });
  }

  return pairs;
}

/**
 * Fetch unmatched lines (by id list from the dashboard), embed as needed,
 * then return Tier 3 pairs. Call this only from a server route.
 */
export async function runAiMatch(input: {
  sessionId: string;
  unmatchedBankIds: string[];
  unmatchedLedgerIds: string[];
}): Promise<MatchedPair[]> {
  let bankLines = await loadLines(
    "bank_lines",
    input.sessionId,
    input.unmatchedBankIds,
    "bank",
  );
  let ledgerLines = await loadLines(
    "ledger_lines",
    input.sessionId,
    input.unmatchedLedgerIds,
    "ledger",
  );

  bankLines = await fillMissingEmbeddings("bank_lines", bankLines);
  ledgerLines = await fillMissingEmbeddings("ledger_lines", ledgerLines);

  return pairBySimilarity(bankLines, ledgerLines);
}
