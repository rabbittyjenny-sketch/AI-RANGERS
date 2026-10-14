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
DATABASE_URL=postgresql://...     ← ต้องมี (server-side เท่านั้น)
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
| `DATABASE_URL` | `postgresql://...` | server-side เท่านั้น (เดิมชื่อ `VITE_DATABASE_URL` — ยังอ่านได้ แต่ให้เปลี่ยนชื่อ) |
| `ELEVENLABS_API_KEY` | `sk_...` | optional |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | optional — โมเดลแชท (default Sonnet 4.6 — Haiku ตอบคุณภาพไม่พอ) |
| `CLAUDE_EFFORT` | `none` | optional — low / medium / high / none (none = ไม่ส่ง) |
| `WEB_SEARCH_MAX_USES` | `2` | optional — ค้นเว็บได้กี่ครั้งต่อข้อความ (0 = ปิด) แนบที่มาจริงท้ายคำตอบ |
| `SEARCH_EXTRA_CREDITS` | `2` | optional — เครดิตที่หักเพิ่มเมื่อข้อความนั้นค้นเว็บจริง |
| `CHAT_RATE_LIMIT` | `40` | optional — ข้อความต่อ IP ต่อชั่วโมง |
| `GUARD_AI_ENABLED` | `true` | optional — `false` ปิดตัวตรวจ AI ทันที |
| `DAILY_CREDITS` | `30` | optional — เครดิตต่อคนต่อวัน (รีเซ็ตเที่ยงคืนเวลาไทย) |
| `DAILY_FILES` | `3` | optional — แนบไฟล์ได้กี่ไฟล์ต่อคนต่อวัน (0 = ไม่จำกัด) |
| `DAILY_USER_CAP` | `20` | optional — ผู้ใช้สูงสุดต่อวันทั้งระบบ |
| `IP_DAILY_USER_LIMIT` | `5` | optional — ผู้ใช้ใหม่ต่อ IP ต่อวัน |
| `CREDITS_ENABLED` | `true` | optional — `false` ปิดระบบเครดิต |
| `ALLOWED_ORIGINS` | `https://...` | optional — โดเมนเพิ่มเติม (custom domain) |

**ห้ามตั้ง** `VITE_ANTHROPIC_API_KEY` หรือ `VITE_CLAUDE_MODEL` — โค้ดเลิกใช้แล้ว และตัวแปร `VITE_` ถูกฝังลง browser
model / max_tokens / web search ถูกกำหนดฝั่ง server เท่านั้น (api/anthropic.js) browser เปลี่ยนไม่ได้

### ฐานข้อมูลและความเป็นเจ้าของแบรนด์
- browser ไม่ต่อฐานข้อมูลตรงแล้ว — อ่าน/เขียนผ่าน `/api/brands` เท่านั้น — **ระบบไม่เก็บประวัติแชทเลย**
- ตารางของ AI Rangers ขึ้นต้นด้วย `ranger_` ทั้งหมด (`ranger_brands`, `ranger_credit_*`, `ranger_usage_log`) — function สร้างเองครั้งแรก ไม่ต้องรัน migration
- ฐานข้อมูล neon-vercel-DB มีตาราง `messages`, `users`, `conversations` ฯลฯ ของแอปเดิมอยู่แล้ว — AI Rangers ไม่อ่าน/เขียนตารางเหล่านั้น **อย่ารัน `drizzle-kit push`** กับฐานนี้ (จะพยายามแก้ตารางที่ไม่ใช่ของเรา)
- แบรนด์ผูกกับรหัสเครื่องของผู้ใช้ (`owner_key` + `client_id`)
- **หลังย้ายเสร็จ ให้เปลี่ยนรหัสผ่าน Neon** เพราะ connection string เดิมเคยอยู่ในไฟล์ที่ browser โหลด

### ระบบเครดิต
เก็บยอดใน Neon (ตาราง `ranger_credit_usage`, `ranger_credit_turns`) — function สร้างตารางเองครั้งแรก
ถ้าไม่มี `DATABASE_URL` จะนับในหน่วยความจำแทน (แม่นน้อยกว่า ดู log `[credits]`)

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
