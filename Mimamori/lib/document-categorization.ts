export interface DocumentCategoryRule {
  mimePattern: string;
  extPattern: string | null;
  documentType: string;
  priority: number;
}

export const DEFAULT_CATEGORY_RULES: DocumentCategoryRule[] = [
  { mimePattern: '', extPattern: 'insurance,policy,coverage,claim,eob,explanation of benefits,copay,deductible,premium,beneficiary,underwriting', documentType: 'Insurance', priority: 105 },
  { mimePattern: 'image/tiff', extPattern: 'tiff,tif', documentType: 'Imaging', priority: 100 },
  { mimePattern: '', extPattern: 'xray,mri,ct-scan,ultrasound,radiology', documentType: 'Imaging', priority: 95 },
  { mimePattern: 'application/dicom', extPattern: 'dicom,dcm', documentType: 'Imaging', priority: 90 },
  { mimePattern: 'image', extPattern: null, documentType: 'Prescription', priority: 80 },
  { mimePattern: 'application/pdf', extPattern: 'pdf', documentType: 'Doctor Note', priority: 70 },
  { mimePattern: 'application/msword', extPattern: 'doc', documentType: 'Doctor Note', priority: 60 },
  { mimePattern: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extPattern: 'docx', documentType: 'Doctor Note', priority: 50 },
  { mimePattern: 'application/vnd.ms-excel', extPattern: 'xls', documentType: 'Lab Result', priority: 40 },
  { mimePattern: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extPattern: 'xlsx', documentType: 'Lab Result', priority: 30 },
];

/**
 * Insurance-related keywords used for content-based detection.
 * If document text content contains any of these terms, it is likely an insurance document.
 */
const INSURANCE_CONTENT_KEYWORDS = [
  'insurance',
  'policy number',
  'policyholder',
  'coverage',
  'claim',
  'explanation of benefits',
  'eob',
  'copay',
  'co-pay',
  'deductible',
  'premium',
  'beneficiary',
  'underwriting',
  'in-network',
  'out-of-network',
  'pre-authorization',
  'prior authorization',
  'member id',
  'group number',
  'subscriber',
  'allowed amount',
  'coinsurance',
];

/**
 * Detect whether text content is likely an insurance document
 * by checking for the presence of insurance-related keywords.
 * Returns true if at least 2 keywords are found (to reduce false positives).
 */
export function detectInsuranceContent(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  let matchCount = 0;
  for (const keyword of INSURANCE_CONTENT_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }
  return false;
}

/**
 * Classify a document by matching its MIME type and extension against categorization rules.
 * Rules are checked in priority order (highest first). Returns the first matching rule's
 * documentType, or defaultType if no rule matches.
 *
 * When `fileName` is provided, the function also checks if the lowercase filename contains
 * any of the patterns in `extPattern` as substring matches.
 */
export function classifyDocument(
  mimeType: string,
  extension: string,
  rules: DocumentCategoryRule[],
  defaultType: string = 'Lab Result',
  fileName?: string,
  content?: string
): string {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const ext = extension.toLowerCase();
  const lowerFileName = fileName?.toLowerCase();

  for (const rule of sorted) {
    const mimeMatches = rule.mimePattern !== '' && mimeType.includes(rule.mimePattern);
    const extMatches =
      rule.extPattern != null &&
      rule.extPattern
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .includes(ext);

    const fileNameMatches =
      lowerFileName != null &&
      rule.extPattern != null &&
      rule.extPattern
        .split(',')
        .some((pattern) => lowerFileName.includes(pattern.trim().toLowerCase()));

    if (mimeMatches || extMatches || fileNameMatches) {
      return rule.documentType;
    }
  }

  // Content-based insurance detection as fallback when no rule matched
  if (content && detectInsuranceContent(content)) {
    return 'Insurance';
  }

  return defaultType;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
}

export interface DisplayCategoryResult {
  displayCategory: string;
  showLowConfidence: boolean;
}

/**
 * Determine the display category and low-confidence badge visibility
 * based on the AI classification result's confidence score.
 *
 * - confidence < 0.3 → displayCategory = "Uncategorized", showLowConfidence = false
 * - 0.3 <= confidence < 0.7 → displayCategory = original category, showLowConfidence = true
 * - confidence >= 0.7 → displayCategory = original category, showLowConfidence = false
 */
export function getDisplayCategory(result: ClassificationResult): DisplayCategoryResult {
  if (result.confidence < 0.3) {
    return { displayCategory: 'Uncategorized', showLowConfidence: false };
  }
  if (result.confidence < 0.7) {
    return { displayCategory: result.category, showLowConfidence: true };
  }
  return { displayCategory: result.category, showLowConfidence: false };
}

/**
 * Classify a document using Bedrock AI vision for image files, falling back
 * to the rule-based `classifyDocument` for non-image files.
 *
 * For images, sends the file URL to Bedrock and asks it to determine the
 * document category and confidence score. If confidence < 0.3, the category
 * is overridden to "Uncategorized".
 */
export async function classifyDocumentWithAI(
  fileUrl: string,
  mimeType: string,
  fileName: string
): Promise<ClassificationResult> {
  // For non-image files, fall back to rule-based classification
  if (!mimeType.startsWith('image/')) {
    const ext = fileName.split('.').pop() || '';
    const category = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
    return { category, confidence: 1.0 };
  }

  // For image files, use Bedrock vision-based classification
  try {
    const { ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const { bedrockClient } = await import('@/lib/aws-clients');
    const { getConfig } = await import('@/lib/config-service');
    const { SYSTEM_GUARDRAIL } = await import('@/lib/ai/guardrails');

    // Extract base64 data from data URL or use the URL directly
    let imageBytes: Uint8Array;
    let format: 'jpeg' | 'png' | 'webp' | 'gif' = 'jpeg';

    if (fileUrl.startsWith('data:image/')) {
      const matches = fileUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        format = (matches[1] === 'jpg' ? 'jpeg' : matches[1]) as 'jpeg' | 'png' | 'webp' | 'gif';
        imageBytes = Uint8Array.from(Buffer.from(matches[2], 'base64'));
      } else {
        // Cannot parse data URL — fall back to rule-based
        const ext = fileName.split('.').pop() || '';
        const category = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Uncategorized', fileName);
        return { category, confidence: 0.5 };
      }
    } else {
      // For non-data URLs, fall back to rule-based (S3 fetch is handled by the caller)
      const ext = fileName.split('.').pop() || '';
      const category = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Uncategorized', fileName);
      return { category, confidence: 0.5 };
    }

    const promptText = `You are a medical document classifier. ${SYSTEM_GUARDRAIL}

Analyze this image and classify it into one of these categories:
- "Lab Result"
- "Prescription"
- "Doctor Note"
- "Insurance"
- "Imaging"
- "Uncategorized"

Determine if this is a medical document or a non-medical image (e.g., selfie, photo).
Non-medical images should be classified as "Uncategorized".

Return ONLY a JSON object with exactly these fields:
{
  "category": "<one of the categories above>",
  "confidence": <number between 0.0 and 1.0>
}

The file name is: "${fileName}"`;

    const appConfig = getConfig();
    const models = [
      'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      appConfig.aws.bedrockRouterArn,
    ];

    let response: any = null;

    for (const modelId of models) {
      try {
        const command = new ConverseCommand({
          modelId,
          messages: [
            {
              role: 'user',
              content: [
                {
                  image: {
                    format,
                    source: { bytes: imageBytes },
                  },
                },
                { text: promptText },
              ],
            },
          ],
          inferenceConfig: { maxTokens: 256, temperature: 0.1 },
        });
        response = await bedrockClient.send(command);
        break;
      } catch (err: unknown) {
        const errObj = err as { name?: string; message?: string };
        console.warn(
          `[classifyDocumentWithAI] Model ${modelId} failed: ${errObj.name} — ${errObj.message}. Trying fallback...`
        );
        continue;
      }
    }

    if (!response) {
      // All models failed — fall back to rule-based
      const ext = fileName.split('.').pop() || '';
      const category = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Uncategorized', fileName);
      return { category, confidence: 0.5 };
    }

    const text = response.output?.message?.content?.[0]?.text || '{}';
    const cleanText = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    const parsed = JSON.parse(cleanText);
    const category = typeof parsed.category === 'string' ? parsed.category : 'Uncategorized';
    const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0;

    // If confidence < 0.3, default to "Uncategorized"
    if (confidence < 0.3) {
      return { category: 'Uncategorized', confidence };
    }

    return { category, confidence };
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    console.error('[classifyDocumentWithAI] Error:', errObj?.name, errObj?.message);
    // On any error, fall back to rule-based classification
    const ext = fileName.split('.').pop() || '';
    const category = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Uncategorized', fileName);
    return { category, confidence: 0.5 };
  }
}
