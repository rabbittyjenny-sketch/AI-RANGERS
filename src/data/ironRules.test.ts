import { describe, it, expect } from 'vitest';
import { getAgentById, getAllAgents } from './agents';
import { aiService } from '../services/aiService';
import { STANDARD_RULES } from './standardRules';

/**
 * กฎเหล็ก/ข้อห้ามของแต่ละน้อง — ตรึงไว้เป็นเทสต์ กันหายโดยไม่รู้ตัวเวลาแก้/รวม/ย้ายชุดคำสั่ง
 * ชุดของน้อง 5 ตัวเดิมตรงกับก่อนเริ่มแก้ไขทุกบรรทัด; ถ้าตั้งใจแก้ข้อห้าม ต้องแก้ไฟล์นี้พร้อมกัน
 */
const IRON_RULES: Record<string, string[]> = {
  "brand-builder": [
    "ห้ามรีบแนะนำทันที — ถามก่อน 1-2 ข้อเสมอ",
    "## ห้ามวิจารณ์แหล่งข้อมูลอื่น",
    "คำต้องห้าม → ห้ามใช้ใน output ทุกชิ้น",
    "ใช้เฉพาะตอนส่งผลงานสำเร็จรูป ห้ามใช้กับการตอบคำถามทั่วไป",
    "4. **ห้ามเสนอตัวส่งต่อเอง** — ถ้า user ไม่ได้ถามว่าน้องตัวไหนช่วยได้ ก็ไม่ต้องพูดถึง",
    "## ห้าม",
    "- ห้ามตอบยาวก่อนได้ข้อมูล",
    "- ห้ามใช้ศัพท์เทคนิคโดยไม่จำเป็น",
    "- ห้ามใช้คำต้องห้ามจาก context"
  ],
  "content-creator": [
    "- คำต้องห้าม → ห้ามใช้โดยเด็ดขาด",
    "ห้ามใช้ tag กับ conversation ทั่วไป",
    "## ห้าม",
    "- ห้ามเขียนประโยคที่ฟังดู AI เขียน",
    "- ห้ามโม้เกินจริงโดยไม่มี USP รองรับ",
    "- ห้ามใช้คำต้องห้ามจาก context",
    "- ห้ามลืม CTA ทุก output"
  ],
  "campaign-planner": [
    "## ห้าม",
    "- ห้ามวางแผนที่ทำไม่ไหวสำหรับคนทำงานคนเดียว",
    "- ห้ามแนะนำ platform ที่ผู้ใช้ไม่มี account",
    "- ห้ามใส่ budget ที่ไม่มีในแผน",
    "- ห้ามใช้คำต้องห้ามจาก context"
  ],
  "business-planner": [
    "4. **ห้ามเสนอตัวส่งต่อเอง** — ถ้า user ไม่ได้ถามว่าน้องตัวไหนช่วยได้ ก็ไม่ต้องพูดถึง",
    "## ห้าม",
    "- ห้ามวางแผนที่ทำคนเดียวไม่ไหว",
    "- ห้ามแนะนำงบโดยไม่รู้ว่าผู้ใช้มีพร้อมไหม",
    "- ห้ามใช้คำต้องห้ามจาก context"
  ],
  "market-insight": [
    "4. **ห้ามเสนอตัวส่งต่อเอง** — ถ้า user ไม่ได้ถามว่าน้องตัวไหนช่วยได้ ก็ไม่ต้องพูดถึง",
    "## ห้าม",
    "- ห้าม hallucinate ตัวเลข — ถ้าไม่แน่ใจต้องบอก \"ประมาณการ\" หรือระบุแหล่งที่มา",
    "- ห้ามฟันธงว่าธุรกิจจะสำเร็จแน่ๆ",
    "- ห้ามวิจารณ์แหล่งข้อมูลอื่นโดยไม่มีอ้างอิง",
    "- ห้ามบังคับใช้ 8 ข้อครบทุกอย่างกับธุรกิจเล็กที่ไม่จำเป็น"
  ],
  "advisor": [
    "4. **ห้ามเสนอตัวส่งต่อเอง** — ถ้า user ไม่ได้ถามว่าน้องตัวไหนช่วยได้ ก็ไม่ต้องพูดถึง",
    "## ห้าม",
    "- ห้ามตอบยาวเกิน 5 ย่อหน้า",
    "- ห้ามใช้ประโยคเยินยอ",
    "- ห้ามใช้คำต้องห้ามจาก context",
    "- ห้ามวิจารณ์แหล่งข้อมูลอื่นโดยไม่มีอ้างอิง",
    "- ห้ามใช้ [WORKFILE] tag"
  ]
};

describe('iron rules (ข้อห้าม) of every Ranger', () => {
  it('covers every Ranger', () => {
    expect(Object.keys(IRON_RULES).sort()).toEqual(getAllAgents().map(a => a.id).sort());
  });

  it.each(Object.entries(IRON_RULES))('%s keeps all its prohibitions', (id, rules) => {
    const prompt = getAgentById(id)!.systemPrompt;
    const have = new Set(prompt.split('\n').map(l => l.trim()));
    for (const rule of rules) expect(have.has(rule), `${id} lost: ${rule}`).toBe(true);
  });

  it('น้องแพลน keeps "ห้ามใส่ budget ที่ไม่มีในแผน" (the ban that was lost when the planners were merged)', () => {
    expect(getAgentById('campaign-planner')!.systemPrompt).toContain('- ห้ามใส่ budget ที่ไม่มีในแผน');
  });

  it('every Ranger has its own ## ห้าม section', () => {
    for (const a of getAllAgents()) expect(a.systemPrompt, a.id).toMatch(/\n## ห้าม\n/);
  });
});

describe('rules added to every answer through the brand context', () => {
  it('forbidden words are restated, no repeated questions, no invented figures', () => {
    const ctx: any = { brandId: '7', brandNameTh: 'ร้านกาแฟดี', coreUSP: ['ออร์แกนิก'], targetAudience: 'คนทำงาน', toneOfVoice: 'friendly', forbiddenWords: ['ถูกที่สุด'], visualStyle: {}, isDefault: false };
    const msg: string = (aiService as any).buildContextMessage(getAgentById('content-creator')!, ctx);
    expect(msg).toContain('คำต้องห้าม: ถูกที่สุด');
    expect(msg).toContain('ห้ามถามซ้ำ');
    expect(msg).toContain('ห้ามเดาหรือแต่งตัวเลข');
    expect(msg).toContain('ไม่เกิน 8-10 บรรทัด');
  });

  it('without brand data it tells the Ranger to ask instead of assuming', () => {
    const msg: string = (aiService as any).buildContextMessage(getAgentById('advisor')!, { brandNameTh: 'ลูกค้าทั่วไป', isDefault: true, visualStyle: {}, coreUSP: [] });
    expect(msg).toContain('ยังไม่มีข้อมูลแบรนด์ที่สมบูรณ์ — ให้ถามผู้ใช้เพิ่มเติม');
    expect(msg).toContain('อย่าสมมติข้อมูลเอง');
  });
});

describe('standard prohibitions (ข้อห้ามมาตรฐาน)', () => {
  it('lists the shared rules once, in one place', () => {
    for (const must of ['ห้ามใช้คำต้องห้ามของแบรนด์', 'ห้ามเดา แต่ง หรือประมาณตัวเลข', 'ห้ามถามข้อมูลแบรนด์', 'ห้ามรับประกัน', 'ห้ามวิจารณ์', 'ห้ามเสนอตัวส่งต่อ', 'กฎหมาย ภาษี', 'ห้ามตอบยาวเกินจำเป็น']) {
      expect(STANDARD_RULES, must).toContain(must);
    }
  });

  it('does not replace a Ranger\'s own prohibitions (they are all still in its prompt)', () => {
    for (const [id, rules] of Object.entries(IRON_RULES)) {
      const prompt = getAgentById(id)!.systemPrompt;
      for (const r of rules) expect(prompt, `${id}: ${r}`).toContain(r);
    }
  });
});
