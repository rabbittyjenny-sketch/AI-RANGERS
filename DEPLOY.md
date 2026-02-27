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

### ทดสอบหลัง deploy
1. เปิด URL → หน้า Home โหลดได้
2. กด "เริ่มใช้งาน" → Workspace เปิดได้
3. เลือก Ranger → ส่งข้อความ → ได้รับคำตอบ (ไม่ใช่ offline fallback)
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
