# Deploy Checklist — Agent Ranger 2

## ก่อน Deploy (ทำครั้งเดียว)

### 1. Neon DB — สร้าง tables
```bash
npm run db:push
```
ต้องมี DATABASE_URL ใน .env ก่อน

### 2. ตรวจสอบ .env
```
ANTHROPIC_API_KEY=sk-ant-...     ← ต้องมี
VITE_DATABASE_URL=postgresql://... ← ต้องมี
ELEVENLABS_API_KEY=sk_...         ← optional
```

## Deploy บน Vercel (แนะนำ)

```bash
npm install -g vercel
vercel
```

### Environment Variables ใน Vercel Dashboard
| Variable | Value | Note |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | server-side เท่านั้น |
| `VITE_DATABASE_URL` | `postgresql://...` | browser + server |
| `ELEVENLABS_API_KEY` | `sk_...` | optional |
| `CLAUDE_MODEL` | `claude-haiku-5-5` | optional — โมเดลแชท (default Haiku 5.5) |
| `CLAUDE_EFFORT` | `low` | optional — low / medium / high / none |
| `WEB_SEARCH_MAX_USES` | `0` | optional — ค่าเริ่มต้นปิด web search |
| `CHAT_RATE_LIMIT` | `40` | optional — ข้อความต่อ IP ต่อชั่วโมง |
| `GUARD_AI_ENABLED` | `true` | optional — `false` ปิดตัวตรวจ AI ทันที |
| `DAILY_CREDITS` | `30` | optional — เครดิตต่อคนต่อวัน (รีเซ็ตเที่ยงคืนเวลาไทย) |
| `DAILY_USER_CAP` | `20` | optional — ผู้ใช้สูงสุดต่อวันทั้งระบบ |
| `IP_DAILY_USER_LIMIT` | `5` | optional — ผู้ใช้ใหม่ต่อ IP ต่อวัน |
| `CREDITS_ENABLED` | `true` | optional — `false` ปิดระบบเครดิต |
| `ALLOWED_ORIGINS` | `https://...` | optional — โดเมนเพิ่มเติม (custom domain) |

**ห้ามตั้ง** `VITE_ANTHROPIC_API_KEY` หรือ `VITE_CLAUDE_MODEL` — โค้ดเลิกใช้แล้ว และตัวแปร `VITE_` ถูกฝังลง browser
model / max_tokens / web search ถูกกำหนดฝั่ง server เท่านั้น (api/anthropic.js) browser เปลี่ยนไม่ได้

### ระบบเครดิต
เก็บยอดใน Neon (ตาราง `ranger_credit_usage`, `ranger_credit_turns`) — function สร้างตารางเองครั้งแรก
ถ้าไม่มี `DATABASE_URL`/`VITE_DATABASE_URL` จะนับในหน่วยความจำแทน (แม่นน้อยกว่า ดู log `[credits]`)

### ตั้งวงเงินใน Claude Console (ทำก่อนเปิดสาธารณะ)
ใน Claude Console (หน้า Limits ของ workspace) ตั้ง spend limit — ตัวกันสุดท้ายถ้ามีคนใช้งานผิดปกติ

### ทดสอบหลัง deploy
1. เปิด URL → หน้า Home โหลดได้
2. กด "เริ่มใช้งาน" → Workspace เปิดได้
3. เลือก Ranger → ส่งข้อความ → ได้รับคำตอบพร้อมป้าย "🛡️ ✅ ผ่านการตรวจ 6 ด้าน"
   - ถ้าเห็น "⚠️ ยังตอบไม่ได้ในขณะนี้" ข้อความจะบอกสาเหตุ (API key / เครดิต / rate limit)
   - ถ้าเห็น "ตรวจได้เฉพาะกฎพื้นฐาน" แปลว่า /api/guard ใช้งานไม่ได้ — ดู Vercel function logs
4. สลับ Ranger แล้วกลับ → แชทเก่ายังอยู่
5. ตั้งค่าแบรนด์ → บันทึก → refresh → ข้อมูลยังอยู่ (Neon)

## Known Limitations (Phase 1)
- Chat ไม่ persist ข้าม browser session (sessionStorage เท่านั้น)
- ไม่มี user authentication
- ไม่รองรับ multi-brand ใน UI (backend รองรับแล้ว)

## Phase 2 (พัฒนาต่อ)
- Login / user accounts
- Chat history ใน Neon (persist ข้ามวัน)
- 5 Agents เพิ่มเติม (visual, brand voice, ads, automation, analytics)
