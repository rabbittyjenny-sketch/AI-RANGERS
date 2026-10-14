/**
 * NoticePopup.jsx
 * ข้อควรรู้ก่อนใช้งาน — แสดงทุกครั้งที่เปิดหน้าเว็บใหม่ (ต่อแท็บ) หลังยอมรับข้อตกลงแล้ว
 * เพราะระบบไม่เก็บประวัติแชท ผู้ใช้ต้องบันทึกงานเองก่อนปิดหน้า
 */

import React from 'react';

const BG = '#F3F6FA';
const NEU_RAISED = { boxShadow: '7px 7px 14px #d4dceb, -7px -7px 14px #ffffff', border: '1px solid rgba(255,255,255,0.7)' };

export const NOTICE_KEY = 'ranger_notice_seen';

const Item = ({ icon, title, children }) => (
  <div style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
    <div style={{ fontSize: 20, lineHeight: '24px', flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1e293b', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.75 }}>{children}</div>
    </div>
  </div>
);

const NoticePopup = ({ onClose }) => {
  const close = () => {
    try { sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* ใช้ต่อได้แม้เก็บไม่ได้ */ }
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="ข้อควรรู้ก่อนใช้งาน" style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(5px)',
      fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif", padding: 20,
    }}>
      <div style={{ background: BG, borderRadius: 26, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px 22px', ...NEU_RAISED }}>
        <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#1e293b' }}>ก่อนเริ่มใช้งาน อ่านสั้นๆ 3 ข้อ</div>

        <Item icon="🗂️" title="ระบบไม่เก็บประวัติแชทย้อนหลัง">
          ปิดหน้าเว็บแล้วข้อความในแชทจะหายไป กรุณาบันทึกสิ่งที่ต้องการไว้ก่อนออก
          โดยคัดลอกข้อความ หรือกด <b>ส่งออก</b> / <b>คัดลอก</b> ที่ช่องไฟล์งาน
          (งานในช่องไฟล์เก็บอยู่ในเครื่องของคุณเท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์จะหายเช่นกัน)
        </Item>

        <Item icon="⚠️" title="คำตอบจาก AI อาจคลาดเคลื่อนได้">
          โดยเฉพาะตัวเลข สถิติ ราคา และกฎหมาย โปรดตรวจสอบกับแหล่งอ้างอิง
          (ดูบรรทัด “ที่มา” ท้ายคำตอบ) ให้แน่ใจก่อนนำไปใช้งานจริงทุกครั้ง
        </Item>

        <Item icon="📊" title="เราเก็บอะไรบ้าง">
          เก็บเฉพาะข้อมูลแบรนด์ที่คุณบันทึก และสถิติว่ามีการใช้น้องตัวไหนกี่ครั้ง
          เพื่อปรับปรุงบริการ — <b>ไม่เก็บเนื้อหาแชท และไม่เก็บไฟล์ที่แนบ</b>
        </Item>

        <button type="button" onClick={close} autoFocus style={{
          width: '100%', marginTop: 10, padding: '12px 16px', borderRadius: 22, border: '1px solid rgba(255,255,255,0.4)',
          cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.86rem',
          background: 'linear-gradient(135deg,#5E9BEB 0%,#6C63FF 100%)',
          boxShadow: '3px 3px 10px rgba(94,155,235,0.4), -2px -2px 6px rgba(255,255,255,0.8)',
        }}>
          รับทราบ เริ่มใช้งาน
        </button>
      </div>
    </div>
  );
};

export default NoticePopup;
