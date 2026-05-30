import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { generateText, generateWithFile } from '@/lib/gemini-client';
import { medicalAi } from '@/lib/medical-ai';
import { getConfig } from '@/lib/config-service';
import { sendEmailWithRetry } from '@/lib/email-retry';
import { detectCriticalKeywords } from '@/lib/critical-alerts';
import { requireAuth } from '@/lib/auth/middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sanitizeForPrompt } from '@/lib/ai/input-sanitizer';
import { SYSTEM_GUARDRAIL } from '@/lib/ai/guardrails';
import { validateFileAnalysisResponse } from '@/lib/ai/validate-schema';
import { callWithCircuitBreaker } from '@/lib/circuit-breaker';
import { validateAnalyzeFileRequest } from '@/lib/api-validation';
import { isValidDosage } from '@/lib/medical-entity-validation';
import { extractTextFromDocx } from '@/lib/docx-extract';

/** Check if an error is a circuit breaker open error */
function isCircuitBreakerOpen(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string };
  return typeof err.message === 'string' && err.message.includes('Circuit breaker is open');
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }
  const userEmail = authResult.user.sub;

  // --- Rate limiting: 5 req/min per user ---
  const rateCheck = checkRateLimit(`analyze-file:${userEmail}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();

    // --- Request validation ---
    const validation = validateAnalyzeFileRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { docName, fileUrl } = body;

    let base64Data: string | null = null;
    let mimeType = 'jpeg';
    let textractText = '';
    let ocrFailed = false;
    let isImage = docName.toLowerCase().match(/\.(jpeg|jpg|png|webp|gif)$/i) || fileUrl.match(/\.(jpeg|jpg|png|webp|gif)$/i);

    if (fileUrl && fileUrl.startsWith('data:image/')) {
        const matches = fileUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
           mimeType = matches[1];
           base64Data = matches[2];
           if (mimeType === 'jpg') mimeType = 'jpeg';
        }
    } else {
        // Download file from Supabase Storage instead of S3
        let storageKey = fileUrl;
        if (fileUrl.startsWith('s3://')) {
          const s3Parts = fileUrl.replace('s3://', '').split('/');
          s3Parts.shift(); // Remove bucket part
          storageKey = s3Parts.join('/');
        } else if (fileUrl.startsWith('supabase://')) {
          storageKey = fileUrl.replace('supabase://', '');
        }

        let byteArray: Uint8Array | undefined;
        try {
           const { data: fileData, error: downloadError } = await supabase.storage
             .from('documents')
             .download(storageKey);

           if (downloadError) throw downloadError;
           if (fileData) {
             byteArray = new Uint8Array(await fileData.arrayBuffer());
           }
        } catch (e) {
           console.error("Failed to fetch object from Supabase Storage:", e);
        }

        if (byteArray) {
           const isTextFile = docName.toLowerCase().match(/\.(txt|csv|tsv|json|xml|html|htm|md|rtf)$/i);
           const isDocx = docName.toLowerCase().match(/\.docx$/i);
           
           if (isImage) {
               base64Data = Buffer.from(byteArray).toString('base64');
               mimeType = Array.isArray(isImage) ? isImage[1].toLowerCase() : 'jpeg';
               if (mimeType === 'jpg') mimeType = 'jpeg';
           } else if (isTextFile) {
               textractText = new TextDecoder('utf-8').decode(byteArray);
               mimeType = 'text';
           } else if (isDocx) {
               textractText = await extractTextFromDocx(Buffer.from(byteArray));
               mimeType = 'text';
               if (!textractText.trim()) {
                 ocrFailed = true;
                 console.warn('[analyze-file] DOCX text extraction returned empty for:', docName);
               }
           } else {
                // It's a PDF. Try extracting text locally using pdf-parse!
                try {
                  const fileBuffer = Buffer.from(byteArray);
                  const pdfParse = require('pdf-parse');
                  const parsed = await pdfParse(fileBuffer);
                  textractText = parsed.text || '';
                  console.log(`[analyze-file] Extracted ${textractText.length} chars from PDF locally.`);
                } catch (pdfErr) {
                  console.error('Local PDF parsing failed:', (pdfErr as Error).message);
                }
                base64Data = Buffer.from(byteArray).toString('base64');
                mimeType = 'pdf';
            }
           
           // Run Gemini Vision OCR for images and PDFs (replacing Textract)
           if (!isTextFile && !textractText.trim()) {
             try {
               const promptOCR = `You are a medical OCR engine. Transcribe ALL visible text in this document accurately. Do not add any interpretations, explainers, or headings. Keep the original text structure as much as possible. Only return the transcribed text.`;
               const fileBuffer = Buffer.from(byteArray);
               const actualMime = isImage ? `image/${mimeType === 'jpeg' ? 'jpeg' : mimeType}` : 'application/pdf';
               
               let ocrResult = '';
               if (actualMime === 'application/pdf') {
                 console.warn('[analyze-file] Scanned PDFs are not supported directly by the vision model. Skipping vision OCR.');
                 ocrFailed = true;
               } else {
                 ocrResult = await generateWithFile(promptOCR, fileBuffer, actualMime, 'orchestrator');
               }
               textractText = ocrResult || '';

               if (!textractText.trim()) {
                 ocrFailed = true;
               }
             } catch (e) {
               console.error("Gemini Vision OCR failed:", (e as Error).message);
               ocrFailed = true;
             }
           }
        }
    }

    let textToAnalyze = textractText.trim() ? textractText : ((fileUrl && fileUrl.length > 50 && !fileUrl.startsWith('data:') && !fileUrl.startsWith('s3://') && !fileUrl.startsWith('supabase://')) ? fileUrl : `Medical Document: ${docName}.`);
    
    console.log(`[analyze-file] Extracted ${textToAnalyze.length} chars. Using ${textractText.trim() ? 'OCR text' : 'fallback'} for analysis.`);
    
    if (textToAnalyze.length > 19000) {
        textToAnalyze = textToAnalyze.substring(0, 19000);
    }

    // --- Sanitize extracted text before prompt embedding ---
    const sanitized = sanitizeForPrompt(textToAnalyze);
    textToAnalyze = sanitized.text;

    // --- Single combined AI call: entity extraction + clinical reasoning ---
    // This replaces the previous two-step pipeline (medicalAi.analyze + separate generateText)
    // to halve API calls and reduce latency.
    const combinedPrompt = `Analyze this medical document titled "${docName}". Act as a clinical assistant reviewing this for a patient.

${SYSTEM_GUARDRAIL}

Raw Document Text:
${textToAnalyze}

Perform TWO tasks in a single response:

TASK 1 - ENTITY EXTRACTION: Extract medical entities from the text:
- MEDICATION entities with dosage and frequency attributes
- TEST_TREATMENT_PROCEDURE entities with test values and units
- MEDICAL_CONDITION entities

TASK 2 - CLINICAL ANALYSIS: Using the extracted entities and the raw text, provide:
- The patient name found in the document
- The true document type (e.g., Insurance, Lab Report, Prescription, Doctor Note)
- A comprehensive clinical summary in plain English
- Precautions, side effects, and follow-up instructions
- Structured biomarker and medication arrays

Return ONLY a JSON object with these exact fields:
{
  "extractedName": "patient name or Unknown",
  "actualType": "document type",
  "summary": "comprehensive clinical summary",
  "precautions": "precautions and follow-up",
  "biomarkers": [{"name": "string", "result": "string", "unit": "string", "range": "string", "status": "High|Low|Attention|Unverified|Status not determined"}],
  "medications": [{"name": "string", "dosage": "string", "frequency": "string"}]
}

Do not include markdown formatting or backticks around the JSON.`;

    let responseText = '';
    try {
      responseText = await callWithCircuitBreaker('gemini', () =>
        generateText(combinedPrompt, 'orchestrator', 0.1, 3072),
      );
    } catch (err: unknown) {
      if (isCircuitBreakerOpen(err)) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 },
        );
      }
      throw err;
    }

    const cleanText = responseText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    try {
      const parsedData = JSON.parse(cleanText);

      // --- Validate Gemini response with schema ---
      const schemaValidation = validateFileAnalysisResponse(parsedData);
      if (!schemaValidation.valid) {
        return NextResponse.json(
          { error: 'AI response format invalid' },
          { status: 502 },
        );
      }

      // Detect critical findings using standardized keyword detection
      const combinedAnalysisText = `${parsedData.summary || ''} ${parsedData.precautions || ''}`;
      const hasCriticalKeywords = detectCriticalKeywords(combinedAnalysisText);

      // Smart Auto-Alert: trigger when clinical severity flags or abnormal biomarkers detected
      const hasAbnormalBiomarkers = (parsedData.biomarkers || []).some((b: any) => 
        b.status === 'High' || b.status === 'Low' || b.status === 'Attention'
      );
      
      const shouldAlert = hasCriticalKeywords || hasAbnormalBiomarkers;
      
      if (shouldAlert) {
         try {
            const alertReasons: string[] = [];
            if (hasCriticalKeywords) alertReasons.push('Clinical severity keywords detected in analysis');
            if (hasAbnormalBiomarkers) {
              const abnormal = (parsedData.biomarkers || []).filter((b: any) => b.status !== 'Status not determined' && b.status !== 'Unverified').filter((b: any) => b.status === 'High' || b.status === 'Low' || b.status === 'Attention').map((b: any) => `${b.name}: ${b.result} (${b.status})`);
              if (abnormal.length > 0) alertReasons.push(`Abnormal biomarkers: ${abnormal.join(', ')}`);
            }

            const caregiverEmail = process.env.AWS_CAREGIVER_EMAIL || '';
            const appConfig = getConfig();

            // --- Always store in-app notification for critical findings in Supabase (Req 30.1) ---
            const now = new Date();
            const alertId = crypto.randomUUID();
            const createdAt = now.toISOString();

            try {
              await supabase
                .from('alerts')
                .insert({
                  id: alertId,
                  email: caregiverEmail || userEmail,
                  type: 'critical-finding',
                  title: `Critical Finding: ${docName}`,
                  message: `A critical finding was detected in document "${docName}" for patient ${parsedData.extractedName || 'Unknown'}. ${alertReasons.join('. ')}.`,
                  read: false,
                  created_at: createdAt,
                  source_doc_id: docName,
                });
              console.log("Stored in-app notification in Supabase for critical finding, docName:", docName);
            } catch (dbError) {
              console.error("Failed to store critical finding notification in Supabase:", dbError);
            }

            if (caregiverEmail) {
                const emailContent = `⚠️ Mimamori Health Alert
                
Document: ${docName}
Patient: ${parsedData.extractedName || 'Unknown'}

Flag Reason: ${alertReasons.join('; ')}

Precautions: ${(parsedData.precautions || '').slice(0, 300)}

Please review the patient dashboard immediately.
— Mimamori AI Health Platform`;

                const emailParams = {
                   Destination: { ToAddresses: [caregiverEmail] },
                   Message: {
                      Body: { Text: { Data: emailContent, Charset: 'UTF-8' } },
                      Subject: { Data: `Mimamori Alert: Condition Worsening for ${parsedData.extractedName || 'Unknown'}`, Charset: 'UTF-8' }
                   },
                   Source: 'noreply@mimamori.ai',
                };

                const emailResult = await sendEmailWithRetry(emailParams, 3);

                if (emailResult.success) {
                  console.log("Auto-Alert sent to caregiver for worsening condition.");
                } else {
                  console.error("SES alert failed after retries:", emailResult.error);
                  try {
                    const undeliveredId = crypto.randomUUID();
                    const undeliveredAt = new Date().toISOString();

                    await supabase
                      .from('alerts')
                      .insert({
                        id: undeliveredId,
                        email: caregiverEmail,
                        type: 'critical-finding',
                        title: `Critical Finding: ${docName}`,
                        message: `A critical finding was detected in document "${docName}" for patient ${parsedData.extractedName || 'Unknown'}. ${alertReasons.join('. ')}. Email notification could not be delivered.`,
                        read: false,
                        created_at: undeliveredAt,
                        source_doc_id: docName,
                      });
                    console.log("Stored undelivered alert in Supabase for caregiver:", caregiverEmail);
                  } catch (dbError) {
                    console.error("Failed to store fallback alert in Supabase:", dbError);
                  }
                }
            }
         } catch (alertError) {
             console.error("Failed to process caregiver alert:", alertError);
         }
      }

      // --- Validate entity confidence and dosage in response ---
      const validatedBiomarkers = (parsedData.biomarkers || []).map((b: any) => ({
        ...b,
        status: b.status === 'Normal' ? 'Status not determined' : (b.status || 'Status not determined'),
      }));

      const validatedMedications = (parsedData.medications || []).map((m: any) => {
        const dosage = m.dosage || 'Unknown';
        return {
          ...m,
          dosageValid: dosage !== 'Unknown' && isValidDosage(dosage),
        };
      });

      return NextResponse.json({ 
        extractedName: parsedData.extractedName || 'Unknown',
        actualType: parsedData.actualType || 'Document',
        summary: parsedData.summary || `Analysis completed for ${docName}.`, 
        precautions: parsedData.precautions || 'No precautions detailed.',
        biomarkers: validatedBiomarkers,
        medications: validatedMedications,
        ...(ocrFailed ? { ocrFailed: true } : {}),
        ...(hasCriticalKeywords ? { criticalFinding: true, criticalFindingMessage: 'Critical finding — review with your care team immediately' } : {}),
      });
    } catch (_parseErr) {
      console.error('Failed to parse Gemini JSON output:', cleanText);
      return NextResponse.json(
        { error: 'AI response format invalid' },
        { status: 502 },
      );
    }
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string; stack?: string };
    console.error('Error generating document analysis via Gemini:', errObj?.name, errObj?.message, errObj?.stack?.slice(0, 300));
    return NextResponse.json({ 
      error: `Analysis failed: ${errObj?.name || 'Unknown'} — ${errObj?.message || 'Check Gemini configuration.'}`,
    }, { status: 500 });
  }
}
