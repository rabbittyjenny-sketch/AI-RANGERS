/**
 * Data Guard — ตรวจคำตอบของ Ranger ก่อนส่งถึงผู้ใช้ (6 ด้าน)
 *
 * ตรวจด้วยกฎในโค้ด (เร็ว ไม่เสียเงิน ผลแน่นอน):
 *   1. isolation        — เนื้อหาชวนขโมย/เจาะข้อมูลคนอื่น
 *   2. antiCopycat      — คล้ายต้นฉบับที่ผู้ใช้ส่งมา, สโลแกน trademark, อ้างชื่อศิลปิน
 *   6. consistency (ส่วนคำต้องห้าม) — ใช้คำที่แบรนด์ห้ามใช้
 *
 * ตรวจด้วย AI ผ่าน /api/guard (ต้องเข้าใจความหมายภาษาไทย):
 *   3. factCheck, 4. uspGrounding, 5. referenceValidation, 6. consistency (โทนเสียง)
 *
 * นโยบาย block (ส่งให้ Claude เขียนใหม่) — เฉพาะกรณีชัดเจน:
 *   isolation, คำต้องห้ามของแบรนด์, ขัดกับ USP โดยตรง, แต่งตัวเลข/สถิติโดยไม่มีที่มา
 * ที่เหลือเป็น warning — แจ้งผู้ใช้แต่ไม่ block
 *
 * ถ้าตัวตรวจ AI ไม่พร้อม: ไม่ block ผู้ใช้ แต่รายงาน aiChecked=false
 * เพื่อให้ UI ไม่แสดงป้ายว่าผ่านการตรวจครบ
 *
 * ห้าม block เพราะ user ไม่กรอกข้อมูลแบรนด์ (guest)
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: any, content: string, metadata?: any) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  source?: string;
}

export type GuardCheckId =
  | 'isolation'
  | 'antiCopycat'
  | 'factCheck'
  | 'uspGrounding'
  | 'referenceValidation'
  | 'consistency';

export interface DataGuardReport {
  contentId?: string;
  timestamp: string;
  checks: Record<GuardCheckId, ValidationResult>;
  overallStatus: 'passed' | 'warning' | 'blocked';
  /** ข้อแนะนำจากทุกด้านที่ไม่ผ่านหรือมีคำเตือน */
  recommendations: string[];
  /** เหตุผลเฉพาะด้านที่ block — ใช้ส่งกลับให้ Claude แก้ */
  blockReasons: string[];
  /** ตัวตรวจ AI ทำงานครบหรือไม่ */
  aiChecked: boolean;
  aiError?: string;
}

export interface GuardContext {
  brandId?: string;
  brandNameTh?: string;
  coreUSP?: string;
  toneOfVoice?: string;
  targetAudience?: string;
  forbiddenWords?: string[];
}

export interface GuardMetadata {
  /** ข้อความต้นฉบับที่ผู้ใช้ส่งมา (เช่น ไฟล์แนบ) ใช้เทียบความคล้าย */
  originalContent?: string;
  userInput?: string;
}

const PASS = (message: string): ValidationResult => ({ passed: true, severity: 'info', message });

// ── 1. ISOLATION ──────────────────────────────────────────────────────────────
// ไม่ block งานวิเคราะห์คู่แข่งตามปกติ — จับเฉพาะเนื้อหาที่ชวนขโมย/เจาะข้อมูล
const THEFT_PATTERNS = [
  /\b(steal|hack|scrape|leak)\w*\b.{0,40}\b(data|database|customer list|credentials?)\b/i,
  /(ขโมย|แฮ็?ก|เจาะระบบ|ลักลอบ).{0,40}(ข้อมูล|ฐานข้อมูล|รายชื่อลูกค้า|รหัสผ่าน)/,
];

export const isolationGuard: ValidationRule = {
  id: 'isolation',
  name: 'Brand Data Isolation',
  description: 'กันเนื้อหาที่ชวนขโมย/เจาะข้อมูลของแบรนด์หรือบุคคลอื่น',
  severity: 'error',
  check: (context: GuardContext, content: string) => {
    if (!context?.brandId || context.brandId === 'guest') {
      return PASS('✅ ผ่าน — ยังไม่มีข้อมูลแบรนด์ (ไม่บังคับ)');
    }
    if (THEFT_PATTERNS.some(p => p.test(content))) {
      return {
        passed: false,
        severity: 'error',
        message: '❌ พบเนื้อหาที่ชวนขโมยหรือเจาะข้อมูลผู้อื่น',
        suggestion: 'ตัดส่วนที่แนะนำให้ขโมย เจาะ หรือดึงข้อมูลของผู้อื่นโดยไม่ได้รับอนุญาตออก',
      };
    }
    return { ...PASS('✅ ผ่าน — Brand isolation ปลอดภัย'), source: `Brand ID: ${context.brandId}` };
  },
};

// ── 2. ANTI-COPYCAT ───────────────────────────────────────────────────────────
const TRADEMARK_SLOGANS = [
  /just do it/i, /think different/i, /i'?m lovin'? it/i,
  /because you'?re worth it/i, /open happiness/i, /impossible is nothing/i,
];
const ARTIST_PATTERN =
  /\b(picasso|van gogh|warhol|monet|banksy|kaws|basquiat|dali)\b|ปิกัสโซ|แวนโก๊ะ|แวน ?โก๊ะ|วอร์ฮอล|แบงก์ซี|บาสเกีย|ดาลี/i;

/** ความคล้ายแบบ character 4-gram Jaccard — เร็วพอสำหรับข้อความยาวใน browser */
export function textSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const grams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i + 4 <= s.length; i++) set.add(s.slice(i, i + 4));
    return set;
  };
  const s1 = norm(a), s2 = norm(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const g1 = grams(s1), g2 = grams(s2);
  if (g1.size === 0 || g2.size === 0) return 0;
  let inter = 0;
  for (const g of g1) if (g2.has(g)) inter++;
  return inter / (g1.size + g2.size - inter);
}

export const antiCopycatGuard: ValidationRule = {
  id: 'antiCopycat',
  name: 'Anti-Copycat & IP Protection',
  description: 'ตรวจความคล้ายต้นฉบับ, สโลแกน trademark และการอ้างชื่อศิลปิน',
  severity: 'warning',
  check: (_context: GuardContext, content: string, metadata?: GuardMetadata) => {
    const slogan = TRADEMARK_SLOGANS.map(p => content.match(p)?.[0]).find(Boolean);
    if (slogan) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ พบสโลแกนที่เป็น trademark ของแบรนด์อื่น: "${slogan}"`,
        suggestion: 'เขียนสโลแกนใหม่ในแบบของแบรนด์เอง',
      };
    }

    const artist = content.match(ARTIST_PATTERN)?.[0];
    if (artist) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ อ้างชื่อศิลปินที่มีตัวตน: "${artist}"`,
        suggestion: 'ใช้ Mood Keywords แทน เช่น แทน "Picasso style" ให้ใช้ "Cubist and artistic"',
      };
    }

    const original = metadata?.originalContent || '';
    if (original.length >= 200) {
      const sim = textSimilarity(original, content);
      if (sim > 0.9) {
        return {
          passed: false,
          severity: 'warning',
          message: `⚠️ เนื้อหาคล้ายต้นฉบับที่ส่งมา ${Math.round(sim * 100)}%`,
          suggestion: 'ถ้าต้นฉบับเป็นงานของผู้อื่น ควรเรียบเรียงใหม่ให้แตกต่าง',
        };
      }
      return PASS(`✅ ผ่าน — ความคล้ายต้นฉบับ ${Math.round(sim * 100)}%`);
    }
    return PASS('✅ ผ่าน — ไม่พบ trademark หรือการอ้างชื่อศิลปิน');
  },
};

// ── 6 (ส่วนกฎ). FORBIDDEN WORDS ──────────────────────────────────────────────
export function findForbiddenWords(content: string, forbiddenWords?: string[]): string[] {
  if (!Array.isArray(forbiddenWords)) return [];
  const lower = content.toLowerCase();
  return forbiddenWords
    .map(w => String(w || '').trim())
    .filter(w => w.length > 0 && lower.includes(w.toLowerCase()));
}

// ── AI checks (/api/guard) ────────────────────────────────────────────────────
type AiVerdict = { verdict: 'pass' | 'warn' | 'fail'; reason: string };
type AiChecks = Record<'factCheck' | 'uspGrounding' | 'referenceValidation' | 'consistency', AiVerdict>;

const AI_CHECK_NAMES: Record<keyof AiChecks, string> = {
  factCheck: 'Fact Check',
  uspGrounding: 'USP Grounding',
  referenceValidation: 'Reference Validation',
  consistency: 'Consistency Check',
};

/** ด้านที่ fail แล้ว block ได้ — ที่เหลือลดเป็น warning */
const AI_BLOCKING: Record<keyof AiChecks, boolean> = {
  factCheck: true,
  uspGrounding: true,
  referenceValidation: false,
  consistency: false,
};

const AI_TIMEOUT_MS = 15000;

async function runAiChecks(
  context: GuardContext,
  content: string,
  metadata?: GuardMetadata
): Promise<{ checks: AiChecks } | { error: string }> {
  if (typeof fetch === 'undefined') return { error: 'fetch unavailable' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch('/api/guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        userInput: metadata?.userInput || '',
        brand: {
          name: context?.brandNameTh || '',
          usp: context?.coreUSP || '',
          tone: context?.toneOfVoice || '',
          audience: context?.targetAudience || '',
        },
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.error?.code || `http_${res.status}` };
    if (data?.skipped) return { error: 'disabled' };
    if (!data?.checks) return { error: 'invalid_response' };
    return { checks: data.checks as AiChecks };
  } catch (err: any) {
    return { error: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function toResult(id: keyof AiChecks, v: AiVerdict): ValidationResult {
  if (v.verdict === 'pass') return PASS(`✅ ${AI_CHECK_NAMES[id]} — ผ่าน`);
  const block = v.verdict === 'fail' && AI_BLOCKING[id];
  return {
    passed: !block,
    severity: block ? 'error' : 'warning',
    message: `${block ? '❌' : '⚠️'} ${AI_CHECK_NAMES[id]} — ${v.reason}`,
    suggestion: v.reason,
  };
}

// ── Master Guardian ───────────────────────────────────────────────────────────

export class DataGuardian {
  /** เปลี่ยนได้ในเทส */
  aiChecksEnabled = true;

  async validateContent(
    context: GuardContext,
    content: string,
    metadata?: GuardMetadata,
    contentId?: string
  ): Promise<DataGuardReport> {
    const checks = {} as Record<GuardCheckId, ValidationResult>;

    checks.isolation = isolationGuard.check(context, content, metadata);
    checks.antiCopycat = antiCopycatGuard.check(context, content, metadata);

    let aiChecked = false;
    let aiError: string | undefined;
    const ai = this.aiChecksEnabled
      ? await runAiChecks(context, content, metadata)
      : { error: 'disabled' };

    if ('checks' in ai) {
      aiChecked = true;
      for (const id of Object.keys(AI_CHECK_NAMES) as Array<keyof AiChecks>) {
        checks[id] = toResult(id, ai.checks[id]);
      }
    } else {
      aiError = ai.error;
      for (const id of Object.keys(AI_CHECK_NAMES) as Array<keyof AiChecks>) {
        checks[id] = PASS(`⏭️ ${AI_CHECK_NAMES[id]} — ไม่ได้ตรวจ (ตัวตรวจ AI ไม่พร้อม)`);
      }
    }

    // คำต้องห้ามของแบรนด์ — กฎในโค้ด, block และมีผลเหนือผล AI ด้าน consistency
    const forbidden = findForbiddenWords(content, context?.forbiddenWords);
    if (forbidden.length > 0) {
      checks.consistency = {
        passed: false,
        severity: 'error',
        message: `❌ ใช้คำต้องห้ามของแบรนด์: ${forbidden.join(', ')}`,
        suggestion: `ห้ามใช้คำเหล่านี้: ${forbidden.join(', ')}`,
      };
    }

    const results = Object.entries(checks) as Array<[GuardCheckId, ValidationResult]>;
    const blocked = results.filter(([, r]) => !r.passed && r.severity === 'error');
    const warned = results.filter(([, r]) => r.severity === 'warning');

    return {
      contentId,
      timestamp: new Date().toISOString(),
      checks,
      overallStatus: blocked.length > 0 ? 'blocked' : warned.length > 0 ? 'warning' : 'passed',
      recommendations: [...blocked, ...warned].map(([, r]) => r.suggestion || r.message),
      blockReasons: blocked.map(([, r]) => r.suggestion || r.message),
      aiChecked,
      aiError,
    };
  }

  generateReport(report: DataGuardReport): string {
    const lines = [
      `📋 Data Guard Report — ${report.timestamp}`,
      `Status: ${report.overallStatus.toUpperCase()}${report.aiChecked ? '' : ' (AI checks unavailable)'}`,
      '',
      '🔍 Checks:',
    ];
    for (const r of Object.values(report.checks)) lines.push(`   ${r.message}`);
    if (report.recommendations.length > 0) {
      lines.push('', '💡 Recommendations:');
      report.recommendations.forEach(rec => lines.push(`   • ${rec}`));
    }
    return lines.join('\n');
  }
}

export const dataGuardian = new DataGuardian();
