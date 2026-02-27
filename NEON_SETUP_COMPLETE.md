# 🚀 Neon PostgreSQL Setup - Complete Guide

## ✅ ตรวจสอบ Schema ที่สมบูรณ์

คุณตอนนี้มี **14 ตาราง** ครบครัน:

### **ตาราง AI Agent (9 ตาราง)**
1. `brands` - ข้อมูลแบรนด์หลัก
2. `messages` - ประวัติการสนทนา
3. `swot_analyses` - ผลวิเคราะห์ตลาด
4. `captions` - แคปชั่นที่สร้างแล้ว
5. `design_assets` - สินทรัพย์ออกแบบ
6. `video_tasks` - งานสร้างวิดีโอ
7. `campaign_schedules` - ตารางแคมเปญ
8. `automated_tools` - เครื่องมืออัตโนมัติ
9. `agent_learnings` - ความเรียนรู้ของเอเจนต์

### **ตาราง Make.com Integration (5 ตาราง)**
10. `content_factory_submissions` - งานสร้างคอนเทนต์
11. `caption_factory_submissions` - งานสร้างแคปชั่นจากรูป
12. `makecom_integration_logs` - บันทึกการเชื่อมต่อ Make.com
13. `automation_schedules` - ตารางอัตโนมัติ
14. `campaign_schedules` - ตารางโพสต์

---

## 🎯 ขั้นตอนการ Setup Neon

### **ขั้นตอนที่ 1: สมัครสมาชิก Neon (ฟรี!)**

1. ไปที่ https://neon.tech
2. คลิก **Sign Up** → เลือก **Sign up with GitHub** (แนะนำ)
3. ยืนยันอีเมล

### **ขั้นตอนที่ 2: สร้าง Project ใน Neon**

1. ใน Dashboard ของ Neon → **New Project**
2. ตั้งชื่อ เช่น: `social-factory-db`
3. เลือก Region: **US East** (เร็ว)
4. คลิก **Create Project**

### **ขั้นตอนที่ 3: คัดลอก Connection String**

1. ใน Project → **Connection Details**
2. หาบรรทัดที่ขึ้นต้นด้วย: `postgresql://`
3. คัดลอกทั้งสตริง (จะประมาณนี้):

```
postgresql://neondb_owner:npg_xxxxxxxxx@ep-xxxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### **ขั้นตอนที่ 4: ตั้งค่า Environment Variable**

สร้างไฟล์ `.env.local` ในโฟลเดอร์ root:

```bash
# .env.local
DATABASE_URL=postgresql://neondb_owner:npg_xxxxxxxxx@ep-xxxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
VITE_DATABASE_URL=postgresql://neondb_owner:npg_xxxxxxxxx@ep-xxxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**⚠️ สำคัญ**: เพิ่ม `.env.local` ในไฟล์ `.gitignore` (อยู่นั้นแล้ว)

### **ขั้นตอนที่ 5: Push Schema ไปยัง Neon**

รันคำสั่ง:

```bash
npm run db:push
```

**ผลลัพธ์ที่คาดหวัง:**
```
✅ Tables created successfully:
  • brands
  • messages
  • swot_analyses
  • captions
  • design_assets
  • video_tasks
  • campaign_schedules
  • automated_tools
  • agent_learnings
  • content_factory_submissions
  • caption_factory_submissions
  • makecom_integration_logs
  • automation_schedules
```

### **ขั้นตอนที่ 6: ตรวจสอบใน Neon Web UI**

1. ไปที่ Neon Dashboard → **SQL Editor**
2. รันคำสั่ง:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

ควรเห็นทั้ง 14 ตาราง ✅

---

## 🔌 Make.com Webhook Integration

### **Webhook URLs ของคุณ:**

**Content Factory:**
```
https://hook.us2.make.com/3kcyu1ygkc8fjv19193apv8oxfhd1c6h
```

**Caption Factory:**
```
https://hook.us2.make.com/e7yel6e6t3ouyf8sv3dbni25nap685tf
```

---

## 💾 Database Service - Updated Methods

### **ส่วนเพิ่มเติม: Content Factory & Caption Factory**

```typescript
// Save Content Factory submission
await databaseService.saveContentFactorySubmission({
  brandId: 1,
  mainCategory: "The Lean Billionaire Factory",
  userEmail: "user@example.com",
  category: "knowledge", // or 'sales'
  postFormat: "Short Clip Video",
  itemId: "card-001",
  platform: "TikTok",
  rawText: "Content description here...",
  fileAsset: "/uploads/image.jpg",
  mimeType: "image/jpeg",
  makeWebhookUrl: "https://hook.us2.make.com/3kcyu..."
});

// Save Caption Factory submission
await databaseService.saveCaptionFactorySubmission({
  lineUserId: "U1234567890abc",
  displayName: "John Doe",
  imageData: "data:image/jpeg;base64,...",
  mood: "VIBRANT",
  userWords: "Modern, Fresh",
  multilingualLevel: 50, // 50% mix
  makeWebhookUrl: "https://hook.us2.make.com/e7yel..."
});

// Log Make.com integration
await databaseService.saveMakecomLog({
  submissionType: "content_factory",
  submissionId: 1,
  webhookUrl: "https://hook.us2.make.com/...",
  requestPayload: { ... },
  responsePayload: { ... },
  status: "success"
});
```

---

## 📊 Useful SQL Queries

### ดูข้อมูลที่ส่งไปยัง Make.com

```sql
SELECT * FROM content_factory_submissions
ORDER BY created_at DESC
LIMIT 10;

SELECT * FROM caption_factory_submissions
ORDER BY created_at DESC
LIMIT 10;

SELECT * FROM makecom_integration_logs
WHERE status = 'failed';
```

### วิเคราะห์ Content Factory

```sql
SELECT
  category,
  COUNT(*) as total_submissions,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM content_factory_submissions
GROUP BY category;
```

---

## ✅ Verification Checklist

- [ ] Neon account สร้างแล้ว
- [ ] Project สร้างแล้ว
- [ ] Connection string คัดลอกแล้ว
- [ ] `.env.local` ตั้งค่าแล้ว
- [ ] รัน `npm run db:push` สำเร็จ
- [ ] ตรวจสอบตารางใน Neon SQL Editor
- [ ] ระบบ dev ทำงาน ✅

---

## 🚀 ถัดไป: Automation Specialist Agent

เมื่อ Neon พร้อมแล้ว ฉันจะสร้าง:
- **Automation Specialist Agent** - ควบคุม Content & Caption Factory
- Make.com webhook integration
- Cron scheduling สำหรับ automated posts
- Analytics dashboard

---

**Status**: Ready for Neon Setup 🎯
**Tables**: 14 ✅
**Make.com Webhooks**: 2 ✅
