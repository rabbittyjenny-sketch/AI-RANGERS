/**
 * TermsPopup.jsx
 * แสดงเมื่อ user เข้าระบบครั้งแรก (localStorage based)
 * กด "ยอมรับและเริ่มใช้งาน" → เก็บ flag → ไม่แสดงซ้ำในเบราว์เซอร์เดิม
 *
 * วิธีใช้งานใน Workspace.jsx:
 * 1. import TermsPopup from './TermsPopup'
 * 2. เพิ่ม state: const [showTerms, setShowTerms] = useState(!localStorage.getItem('ranger_terms_accepted'))
 * 3. ใส่ใน JSX ก่อน render หลัก: {showTerms && <TermsPopup onAccept={() => setShowTerms(false)} />}
 */

import React, { useState } from 'react';

const BG = '#F3F6FA';
const NEU_RAISED = { boxShadow: '7px 7px 14px #d4dceb, -7px -7px 14px #ffffff', border: '1px solid rgba(255,255,255,0.7)' };
const NEU_INSET = { boxShadow: 'inset 3px 3px 6px #d4dceb, inset -3px -3px 6px #ffffff' };

const TermsPopup = ({ onAccept }) => {
  const [checked, setChecked] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleAccept = () => {
    if (!checked) return;
    localStorage.setItem('ranger_terms_accepted', 'true');
    onAccept();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)',
      fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif",
      padding: 20,
    }}>
      <div style={{
        background: BG, borderRadius: 28, width: '100%', maxWidth: 520,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        ...NEU_RAISED, overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ flexShrink: 0, padding: '24px 28px 16px', borderBottom: '1px solid rgba(209,217,230,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            {/* Logo */}
            <img
              src="https://ik.imagekit.io/ideas365logo/ideas365-logo.png"
              alt="iDEAS365"
              style={{ height: 32, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                ยินดีต้อนรับสู่ AI Rangers
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                โปรดอ่านและยอมรับข้อตกลงก่อนเริ่มใช้งาน
              </div>
            </div>
          </div>

          {/* Beta badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg,#EEF2FF,#E0F2FE)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 99, padding: '4px 12px', marginTop: 8,
          }}>
            <span style={{ fontSize: 12 }}>🎁</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4338ca' }}>
              ขณะนี้เปิดให้ใช้งานฟรี — ในช่วง Early Access
            </span>
          </div>
        </div>

        {/* ── Body — Terms ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px' }}>

          <TermsSection title="1. ข้อจำกัดความรับผิดชอบ">
            คำตอบที่ได้รับจากระบบ AI Rangers สร้างขึ้นโดยปัญญาประดิษฐ์
            ซึ่งอาจมีความคลาดเคลื่อนหรือข้อผิดพลาดได้
            ผู้ใช้ควรตรวจสอบความถูกต้องของข้อมูล โดยเฉพาะตัวเลข สถิติ
            และข้อมูลเชิงธุรกิจก่อนนำไปใช้งานจริงทุกครั้ง
            iDEAS365 ไม่รับผิดชอบต่อความเสียหายใดๆ
            ที่เกิดจากการนำผลลัพธ์ของระบบไปใช้งาน
          </TermsSection>

          <TermsSection title="2. การใช้ข้อมูลของคุณ">
            ข้อมูลแบรนด์ที่คุณกรอกเข้าระบบจะถูกใช้เพื่อปรับปรุงคุณภาพคำตอบ
            ภายใน session การใช้งานของคุณเท่านั้น
            ระบบจะไม่นำข้อมูลของคุณไปเปิดเผยต่อบุคคลที่สาม
            หรือนำไปใช้เพื่อวัตถุประสงค์อื่นใดนอกเหนือจากที่ระบุ
          </TermsSection>

          <TermsSection title="3. ข้อห้ามในการใช้งาน">
            ห้ามนำผลลัพธ์จากระบบไปใช้ในลักษณะที่ละเมิดลิขสิทธิ์
            หรือทรัพย์สินทางปัญญาของผู้อื่น
            ห้ามใช้ระบบเพื่อสร้างเนื้อหาที่ผิดกฎหมาย
            หลอกลวง หรือสร้างความเสียหายแก่บุคคลอื่น
            การใช้งานผิดวัตถุประสงค์อาจถูกระงับการเข้าถึงโดยไม่ต้องแจ้งล่วงหน้า
          </TermsSection>

          <TermsSection title="4. ช่วง Early Access (ใช้งานฟรี)">
            ระบบอยู่ในช่วง Early Access ซึ่งเปิดให้ใช้งานโดยไม่มีค่าใช้จ่าย
            iDEAS365 ขอสงวนสิทธิ์ในการปรับเปลี่ยนเงื่อนไขการให้บริการ
            ฟีเจอร์ หรือรูปแบบการคิดค่าบริการในอนาคต
            โดยจะแจ้งให้ทราบล่วงหน้าผ่านช่องทางที่เหมาะสม
          </TermsSection>

          {/* คู่มือการใช้งาน */}
          <div style={{
            background: 'linear-gradient(135deg,#EEF2FF,#F0FDF4)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 14, padding: '12px 16px', marginTop: 6,
          }}>
            <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.82rem', marginBottom: 6 }}>
              📖 ยังไม่เคยใช้งานมาก่อน?
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.7 }}>
              แนะนำให้อ่านคู่มือการใช้งานก่อนเริ่มต้น
              เพื่อให้ได้ประโยชน์สูงสุดจากระบบ AI Rangers
            </p>
            <button
              onClick={() => setShowGuide(!showGuide)}
              style={{
                background: BG, border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 99, padding: '5px 14px', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 700, color: '#4338ca',
                boxShadow: '2px 2px 6px #d4dceb, -2px -2px 6px #ffffff',
              }}
            >
              {showGuide ? '▲ ซ่อนคู่มือ' : '▼ ดูคู่มือการใช้งาน'}
            </button>

            {showGuide && (
              <div style={{
                marginTop: 12, background: BG, borderRadius: 12, padding: '12px 14px',
                ...NEU_INSET, fontSize: '0.76rem', color: '#475569', lineHeight: 1.8,
              }}>
                <GuideContent />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer — Checkbox + Button ── */}
        <div style={{ flexShrink: 0, padding: '16px 28px 24px', borderTop: '1px solid rgba(209,217,230,0.5)' }}>
          {/* Checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: 'pointer', marginBottom: 16,
          }}>
            <div
              onClick={() => setChecked(!checked)}
              style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: `2px solid ${checked ? '#5E9BEB' : '#cbd5e1'}`,
                background: checked ? '#5E9BEB' : BG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: checked ? '0 0 0 3px rgba(94,155,235,0.2)' : '2px 2px 4px #d4dceb, -2px -2px 4px #ffffff',
              }}
            >
              {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.65 }}>
              ฉันได้อ่านและยอมรับ<strong style={{ color: '#1e293b' }}>ข้อตกลงการใช้งาน</strong>แล้ว
              และเข้าใจว่าระบบอยู่ในช่วง Early Access
              ผลลัพธ์ที่ได้ควรตรวจสอบก่อนนำไปใช้งานจริง
            </span>
          </label>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={!checked}
            style={{
              width: '100%', padding: '12px', borderRadius: 16, border: 'none',
              cursor: checked ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: '0.9rem', color: '#fff',
              transition: 'all 0.2s',
              background: checked
                ? 'linear-gradient(135deg,#5E9BEB 0%,#6C63FF 100%)'
                : '#e2e8f0',
              color: checked ? '#fff' : '#94a3b8',
              boxShadow: checked ? '3px 3px 10px rgba(94,155,235,0.35)' : 'none',
            }}
          >
            {checked ? '✅ ยอมรับและเริ่มใช้งาน' : 'กรุณายืนยันการรับทราบก่อนเริ่มใช้งาน'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
            Powered by iDEAS365 × Claude AI | Early Access Version
          </p>
        </div>
      </div>

      {/* Guide Modal */}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TermsSection = ({ title, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: 5 }}>
      {title}
    </div>
    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.75 }}>
      {children}
    </p>
  </div>
);

const GuideContent = () => (
  <div>
    <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#334155' }}>🚀 เริ่มต้นใช้งาน 4 ขั้นตอน</p>
    <div style={{ marginBottom: 6 }}>
      <strong>ขั้นที่ 1 — ตั้งค่าแบรนด์</strong><br />
      คลิกปุ่ม ⚙ แบรนด์ → กรอกข้อมูลธุรกิจ (ชื่อแบรนด์, USP, กลุ่มลูกค้า)
      เพื่อให้น้องทุกตัวรู้จักแบรนด์ของคุณ ไม่ต้องอธิบายซ้ำทุกครั้ง
    </div>
    <div style={{ marginBottom: 6 }}>
      <strong>ขั้นที่ 2 — เลือกน้อง</strong><br />
      คลิกไอคอนน้องที่ต้องการจากแถบซ้าย แต่ละตัวเชี่ยวชาญต่างกัน
    </div>
    <div style={{ marginBottom: 6 }}>
      <strong>ขั้นที่ 3 — สั่งงาน</strong><br />
      พิมพ์ หรือกด 🎤 Mic Start เพื่อพูดสั่งงานเป็นภาษาไทย
      หรือแนบไฟล์ภาพ/เอกสารได้สูงสุด 5 ไฟล์
    </div>
    <div style={{ marginBottom: 6 }}>
      <strong>ขั้นที่ 4 — จัดการผลลัพธ์</strong><br />
      Copy ข้อความไปใช้ได้เลย หรือสั่งให้ปรับแก้จนพอใจ
      ไฟล์งานจะเก็บไว้ที่ 📁 ไฟล์งาน
    </div>
    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(94,155,235,0.08)', borderRadius: 8, fontSize: '0.72rem', color: '#334155' }}>
      💡 <strong>เคล็ดลับ:</strong> ยิ่งกรอกข้อมูลแบรนด์ครบ ผลลัพธ์ยิ่งตรงกับธุรกิจของคุณ
    </div>
  </div>
);

export default TermsPopup;
