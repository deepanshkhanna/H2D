import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGeminiProvider } from "./ai-gateway";
import { strengthForConfidence, type StrengthLabel } from "./strength";

const MODEL = "gemini-1.5-flash";

function caseRef() {
  return `CASE-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("cases")
      .select("*, conclusions(needs_human_review)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      ...c,
      needs_review_count: (c.conclusions ?? []).filter((x: any) => x.needs_human_review).length,
    }));
  });

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string }) =>
    z.object({ title: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cases")
      .insert({ user_id: userId, title: data.title, reference: caseRef() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [caseQ, evidenceQ, conclusionsQ, eventsQ, linksQ] = await Promise.all([
      supabase.from("cases").select("*").eq("id", data.id).single(),
      supabase.from("evidence").select("*").eq("case_id", data.id).order("uploaded_at"),
      supabase
        .from("conclusions")
        .select("*")
        .eq("case_id", data.id)
        .order("is_primary", { ascending: false })
        .order("confidence", { ascending: false }),
      supabase.from("case_events").select("*").eq("case_id", data.id).order("occurred_at"),
      supabase
        .from("conclusion_evidence")
        .select("*")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? ""),
    ]);
    if (caseQ.error) throw new Error(caseQ.error.message);
    return {
      case: caseQ.data,
      evidence: evidenceQ.data ?? [],
      conclusions: conclusionsQ.data ?? [],
      events: eventsQ.data ?? [],
      links: linksQ.data ?? [],
    };
  });

export const uploadEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      caseId: string;
      filename: string;
      kind: string;
      contentBase64: string;
      mimeType: string;
    }) =>
      z
        .object({
          caseId: z.string().uuid(),
          filename: z.string().min(1).max(255),
          kind: z.enum(["invoice", "email", "manifest", "inspection", "photo", "other"]),
          contentBase64: z.string().min(1),
          mimeType: z.string().min(1).max(255),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const path = `${userId}/${data.caseId}/${Date.now()}-${data.filename}`;
    const bytes = Buffer.from(data.contentBase64, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");

    const { error: upErr } = await supabase.storage.from("evidence").upload(path, bytes, {
      contentType: data.mimeType,
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);

    const { data: ev, error: insErr } = await supabase
      .from("evidence")
      .insert({
        case_id: data.caseId,
        user_id: userId,
        kind: data.kind as any,
        filename: data.filename,
        storage_path: path,
        mime_type: data.mimeType,
        status: "uploaded",
        input_hash: hash,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabase.from("case_events").insert({
      case_id: data.caseId,
      user_id: userId,
      kind: "evidence_uploaded",
      title: `${data.kind} uploaded · ${data.filename}`,
      payload: { evidence_id: ev.id },
    });

    return ev;
  });

const ExtractionSchema = z.object({
  summary: z.string(),
  entities: z
    .array(
      z.object({
        type: z.string(),
        value: z.string(),
        confidence: z.number().min(0).max(100),
      }),
    )
    .max(40),
});

export const extractEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { evidenceId: string }) =>
    z.object({ evidenceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error } = await supabase
      .from("evidence")
      .select("*")
      .eq("id", data.evidenceId)
      .single();
    if (error || !ev) throw new Error(error?.message ?? "Evidence not found");

    await supabase.from("evidence").update({ status: "extracting" }).eq("id", ev.id);

    const { data: file } = await supabase.storage.from("evidence").download(ev.storage_path);
    let textContent = "";
    if (file) {
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      if (
        ev.mime_type?.startsWith("text/") ||
        ev.mime_type?.includes("json") ||
        ev.filename.match(/\.(txt|csv|md|json|eml)$/i)
      ) {
        textContent = buf.toString("utf-8").slice(0, 30000);
      } else {
        textContent = `[binary ${ev.mime_type ?? "file"} · ${buf.byteLength} bytes · filename ${ev.filename}]`;
      }
    }

    const provider = createGeminiProvider();
    const model = provider(MODEL) as unknown as LanguageModel;

    let extracted: z.infer<typeof ExtractionSchema> = { summary: "", entities: [] };
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ExtractionSchema }),
        prompt: `You are OpsPilot's evidence extractor. From the following operational document, return a one-paragraph summary plus extracted entities.

Entity types to look for: shipment_id, po_number, invoice_number, vendor, sku, quantity, amount_usd, person_email, person_name, location, carrier, date_iso, anomaly.

Use 0-100 confidence per entity. Be conservative.

Document kind: ${ev.kind}
Filename: ${ev.filename}
Content:
${textContent}`,
      });
      extracted = output;
    } catch (e) {
      console.error("extract failed", e);
      await supabase.from("evidence").update({ status: "failed" }).eq("id", ev.id);
      throw new Error("AI extraction failed: " + (e as Error).message);
    }

    await supabase
      .from("evidence")
      .update({
        status: "extracted",
        extracted_json: extracted as any,
        summary: extracted.summary,
      })
      .eq("id", ev.id);

    if (extracted.entities.length) {
      await supabase.from("entities").insert(
        extracted.entities.map((e) => ({
          case_id: ev.case_id,
          user_id: userId,
          source_evidence_id: ev.id,
          type: e.type,
          value: e.value,
          confidence: e.confidence,
        })),
      );
    }

    await supabase.from("case_events").insert({
      case_id: ev.case_id,
      user_id: userId,
      kind: "entity_extracted",
      title: `Extracted ${extracted.entities.length} entities from ${ev.filename}`,
      payload: { evidence_id: ev.id, count: extracted.entities.length },
    });

    return { ev_id: ev.id, count: extracted.entities.length };
  });

const ConclusionsSchema = z.object({
  conclusions: z
    .array(
      z.object({
        title: z.string().max(120),
        severity: z.enum(["low", "medium", "high", "critical"]),
        root_cause: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(100),
        financial_exposure_usd: z.number().min(0),
        recommended_action: z.string().max(200),
        evidence_filenames: z.array(z.string()),
      }),
    )
    .max(5),
});

export const correlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { caseId: string }) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase.from("evidence").select("*").eq("case_id", data.caseId);
    const { data: ents } = await supabase.from("entities").select("*").eq("case_id", data.caseId);
    if (!ev || ev.length < 1) throw new Error("Need at least 1 piece of evidence");

    await supabase
      .from("cases")
      .update({ status: "correlating", updated_at: new Date().toISOString() })
      .eq("id", data.caseId);

    const inputHash = createHash("sha256")
      .update(JSON.stringify({ ev: ev.map((x) => x.input_hash), ents }))
      .digest("hex");
    const runAt = new Date().toISOString();

    const evidenceSummaries = ev
      .map((e) => `- [${e.kind}] ${e.filename}: ${e.summary ?? "(no summary)"}`)
      .join("\n");
    const entitiesGrouped = (ents ?? [])
      .map(
        (e) =>
          `  - ${e.type}: ${e.value} (from ${ev.find((x) => x.id === e.source_evidence_id)?.filename}, conf ${e.confidence})`,
      )
      .join("\n");

    const provider = createGeminiProvider();
    const model = provider(MODEL) as unknown as LanguageModel;

    const { output } = await generateText({
      model,
      output: Output.object({ schema: ConclusionsSchema }),
      prompt: `You are OpsPilot's correlation engine. Given this operational evidence, identify discrepancies, shortages, fraud signals, or risks. For each conclusion, cite which evidence files prove it.

Evidence:
${evidenceSummaries}

Extracted entities:
${entitiesGrouped}

Return 1-3 conclusions ranked by importance. Be specific. Financial exposure should be in USD (number only, not cents). Confidence 0-100. The first conclusion is the most important.`,
    });

    // Clear previous AI-generated conclusions for this run
    await supabase.from("conclusions").delete().eq("case_id", data.caseId);

    const evByFilename = new Map(ev.map((e) => [e.filename, e.id]));
    let primary = true;
    let totalExposure = 0;
    let needsReview = false;
    let topSeverity: "low" | "medium" | "high" | "critical" = "low";
    const order = { low: 0, medium: 1, high: 2, critical: 3 };

    for (const c of output.conclusions) {
      const strength: StrengthLabel = strengthForConfidence(c.confidence);
      const reviewFlag = c.confidence < 70;
      if (reviewFlag) needsReview = true;
      if (order[c.severity] > order[topSeverity]) topSeverity = c.severity;
      totalExposure += Math.round(c.financial_exposure_usd * 100);

      const { data: cRow, error: cErr } = await supabase
        .from("conclusions")
        .insert({
          case_id: data.caseId,
          user_id: userId,
          title: c.title,
          severity: c.severity,
          root_cause: c.root_cause,
          reasoning: c.reasoning,
          confidence: c.confidence,
          strength_label: strength,
          financial_exposure_cents: Math.round(c.financial_exposure_usd * 100),
          recommended_action: c.recommended_action,
          needs_human_review: reviewFlag,
          is_primary: primary,
          model_name: MODEL,
          model_run_at: runAt,
          input_hash: inputHash,
        })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);

      const links = c.evidence_filenames
        .map((f) => evByFilename.get(f))
        .filter((x): x is string => !!x)
        .map((evidence_id) => ({ conclusion_id: cRow.id, evidence_id, user_id: userId }));
      if (links.length) await supabase.from("conclusion_evidence").insert(links);

      primary = false;
    }

    const newStatus = needsReview ? "review_needed" : "confirmed";
    await supabase
      .from("cases")
      .update({
        status: newStatus as any,
        severity: topSeverity as any,
        financial_exposure_cents: totalExposure,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.caseId);

    await supabase.from("case_events").insert([
      {
        case_id: data.caseId,
        user_id: userId,
        kind: "correlation_found",
        title: `Correlation complete · ${output.conclusions.length} conclusion(s)`,
        payload: { count: output.conclusions.length },
      },
      ...output.conclusions.map((c) => ({
        case_id: data.caseId,
        user_id: userId,
        kind: "conclusion_generated" as const,
        title: c.title,
        payload: { confidence: c.confidence, exposure_usd: c.financial_exposure_usd },
      })),
      {
        case_id: data.caseId,
        user_id: userId,
        kind: "status_changed",
        title: `Status → ${newStatus}`,
        payload: { from: "correlating", to: newStatus },
      },
    ]);

    return { count: output.conclusions.length };
  });

export const signedEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { evidenceId: string }) =>
    z.object({ evidenceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ev } = await supabase
      .from("evidence")
      .select("storage_path")
      .eq("id", data.evidenceId)
      .single();
    if (!ev) throw new Error("not found");
    const { data: s, error } = await supabase.storage
      .from("evidence")
      .createSignedUrl(ev.storage_path, 300);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl };
  });
