import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, ArrowRight, Mic, Paperclip, Sparkles, BarChart3, Zap,
  Shield, ChevronDown, BookOpen
} from 'lucide-react';

// ── Table of Contents entries ─────────────────────────────────────────────────
const TOC = [
  { id: 'overview',   label: 'ภาพรวมระบบ',        icon: '🌐' },
  { id: 'flow',       label: 'วิธีใช้งาน 3 ขั้น', icon: '⚡' },
  { id: 'rangers',    label: '10 Rangers',          icon: '🤖' },
  { id: 'dataguard',  label: '6-Layer Data Guard',  icon: '🛡️' },
  { id: 'features',   label: 'ฟีเจอร์พิเศษ',       icon: '✨' },
  { id: 'faq',        label: 'คำถามพบบ่อย',         icon: '💬' },
];

const CLUSTERS = [
  {
    icon: BarChart3, color: '#FF6B6B', name: 'Strategy', nameTh: 'วางกลยุทธ์',
    agents: [
      { emoji: '📊', name: 'Market Analyzer', desc: 'วิเคราะห์ตลาด ศึกษาคู่แข่ง หา Market Gap' },
      { emoji: '🎯', name: 'Positioning Strategist', desc: 'กำหนดตำแหน่งแบรนด์ สร้าง USP และ Value Proposition' },
      { emoji: '👥', name: 'Customer Insight Specialist', desc: 'วิเคราะห์ Customer Journey และ Persona' },
    ]
  },
  {
    icon: Sparkles, color: '#A78BFA', name: 'Creative', nameTh: 'สร้างตัวตนแบรนด์',
    agents: [
      { emoji: '🎨', name: 'Visual Strategist', desc: 'ออกแบบ Visual System สี Typography โลโก้' },
      { emoji: '🗣️', name: 'Brand Voice Architect', desc: 'กำหนด Tone & Voice และ Communication Playbook' },
      { emoji: '📚', name: 'Narrative Designer', desc: 'สร้าง Brand Story เส้นทาง Hero\'s Journey' },
    ]
  },
  {
    icon: Zap, color: '#34D399', name: 'Growth', nameTh: 'ขับเคลื่อนการเติบโต',
    agents: [
      { emoji: '✨', name: 'Content Creator', desc: 'สร้าง Caption, Video Script, Visual Direction' },
      { emoji: '📅', name: 'Campaign Planner', desc: 'วางแผน Campaign 30 วัน, Content Calendar' },
      { emoji: '⚙️', name: 'Automation Specialist', desc: 'ออกแบบ Workflow Automation, Email, CRM' },
      { emoji: '📊', name: 'Analytics Master', desc: 'KPI Dashboard, Measurement Framework' },
    ]
  },
];

const DATA_GUARD_LAYERS = [
  { num: '01', name: 'Isolation Guard',        desc: 'ป้องกันข้อมูลแบรนด์รั่วไหลข้ามกัน แยกข้อมูลแบรนด์ด้วย brandId อย่างเข้มงวด', color: '#FF6B6B' },
  { num: '02', name: 'Anti-Copycat Guard',      desc: 'ตรวจสอบความแตกต่างจาก output ก่อนหน้า > 70% ป้องกันการซ้ำซ้อนของคอนเทนต์', color: '#F59E0B' },
  { num: '03', name: 'Fact Check Guard',        desc: 'ตรวจจับ AI Hallucination สถิติที่ไม่มีแหล่งอ้างอิง บังคับให้ระบุที่มาเมื่อมีตัวเลข', color: '#5E9BEB' },
  { num: '04', name: 'USP Grounding Guard',     desc: 'ตรวจสอบว่าคำตอบสอดคล้องกับ Core USP ของแบรนด์ ป้องกันการพูดขัดแย้งจุดขาย', color: '#A78BFA' },
  { num: '05', name: 'Reference Validation',    desc: 'บังคับระบุแหล่งที่มาเมื่ออ้างอิง Trend หรือข้อมูล ป้องกันการอ้างอิงลอยๆ', color: '#34D399' },
  { num: '06', name: 'Consistency Check',       desc: 'ตรวจสอบ Mood & Tone ตรงกับการตั้งค่า Onboarding ป้องกัน Tone Mismatch', color: '#06B6D4' },
];

const FAQS = [
  { q: 'ต้องกรอกข้อมูลแบรนด์ก่อนไหม?', a: 'แนะนำค่ะ เพราะ Rangers ใช้ข้อมูลแบรนด์เป็นบริบทในการตอบ ถ้าไม่กรอก Rangers จะถามระหว่างแชทแทน' },
  { q: 'ทำไม AI ถึงตอบไม่ตรงกับที่ถาม?', a: 'ลองตั้งค่าข้อมูลแบรนด์ให้ครบ (กดปุ่ม ⚙ ในช่อง input) แล้ว Rangers จะตอบตรงประเด็นมากขึ้น' },
  { q: 'Voice Input รองรับภาษาอะไร?', a: 'รองรับภาษาไทย (TH-TH) เป็นหลักและภาษาอังกฤษ ต้องใช้ Chrome หรือ Edge ที่รองรับ Web Speech API' },
  { q: 'แนบไฟล์ประเภทไหนได้บ้าง?', a: 'JPG, PNG, GIF, PDF, Word (.doc/.docx), Text — ขนาดสูงสุด 10MB ต่อไฟล์' },
  { q: 'ผลลัพธ์ถูกต้องแค่ไหน?', a: 'มีระบบ 6-Layer Data Guard ตรวจสอบทุกคำตอบ ได้แก่ Fact Check, USP Grounding, Anti-Copycat และ Consistency Check' },
  { q: 'Ranger แต่ละตัวต่างกันอย่างไร?', a: 'แต่ละ Ranger มี System Prompt และ Specialization เฉพาะทาง เช่น Market Analyzer เน้นวิเคราะห์ตลาด ส่วน Content Creator เน้นสร้างคอนเทนต์ ไม่ควรใช้สลับกัน' },
];

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-6 mb-14">
    <h2 className="text-xl font-bold text-slate-700 mb-5 pb-3"
      style={{ borderBottom: '1px solid #e2e8f0' }}>
      {title}
    </h2>
    {children}
  </section>
);

const neuCard = { background: '#EFF2F9', boxShadow: '6px 6px 16px #d1d9e6, -6px -6px 16px #ffffff', borderRadius: 20 };

// ── Main GuidePage ────────────────────────────────────────────────────────────
export const GuidePage = ({ onBack, onStartChat }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [openFaq, setOpenFaq] = useState(null);
  const sectionRefs = useRef({});

  // Track active section on scroll
  useEffect(() => {
    const container = document.getElementById('guide-content');
    if (!container) return;

    const onScroll = () => {
      const scrollTop = container.scrollTop + 80;
      let active = TOC[0].id;
      for (const { id } of TOC) {
        const el = sectionRefs.current[id];
        if (el && el.offsetTop <= scrollTop) active = id;
      }
      setActiveSection(active);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    const el = sectionRefs.current[id];
    const container = document.getElementById('guide-content');
    if (el && container) container.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#EFF2F9' }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200"
        style={{ background: '#EFF2F9' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#EFF2F9', boxShadow: '3px 3px 8px #d1d9e6, -3px -3px 8px #ffffff' }}>
            <BookOpen className="w-4 h-4" style={{ color: '#5E9BEB' }} />
          </div>
          <span className="font-bold text-slate-700 text-sm">คู่มือการใช้งาน</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button onClick={onStartChat}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ background: '#5E9BEB' }}>
            เริ่มใช้งาน <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
          <button onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
            style={{ background: '#EFF2F9', boxShadow: '3px 3px 8px #d1d9e6, -3px -3px 8px #ffffff' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body: Left TOC + Right Content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — sticky TOC */}
        <div className="hidden md:flex flex-col flex-shrink-0 py-6 px-4 overflow-y-auto"
          style={{ width: 220, borderRight: '1px solid #e2e8f0' }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-2">สารบัญ</p>
          <nav className="space-y-1">
            {TOC.map(({ id, label, icon }) => {
              const active = activeSection === id;
              return (
                <button key={id} onClick={() => scrollTo(id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
                  style={active
                    ? { background: '#EFF2F9', boxShadow: 'inset 3px 3px 7px #d1d9e6, inset -3px -3px 7px #ffffff', color: '#5E9BEB', fontWeight: 600 }
                    : { color: '#64748b', background: 'transparent' }
                  }>
                  <span className="text-base">{icon}</span>
                  <span className="font-sarabun leading-tight">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <motion.button onClick={onStartChat}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#5E9BEB' }}>
              เริ่มสร้าง <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Right — scrollable content */}
        <div id="guide-content" className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">

            {/* ── Section 1: Overview ── */}
            <div ref={el => sectionRefs.current['overview'] = el}>
              <Section id="overview" title="🌐 ภาพรวมระบบ Agent Ranger">
                <div style={neuCard} className="p-6">
                  <p className="text-slate-600 font-sarabun leading-relaxed mb-4">
                    <strong>Agent Ranger</strong> คือ AI Platform สำหรับงาน Brand Strategy, Creative Content และ Growth Marketing
                    ที่ใช้ <strong>10 Rangers</strong> ใน <strong>3 กลุ่ม</strong> ทำงานร่วมกัน
                    ผ่านระบบ 6-Layer Data Guard ที่ตรวจสอบคุณภาพทุกคำตอบ
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { n: '10', label: 'AI Rangers', color: '#5E9BEB' },
                      { n: '3', label: 'กลุ่มงาน', color: '#A78BFA' },
                      { n: '6', label: 'Layer Guard', color: '#34D399' },
                    ].map(s => (
                      <div key={s.n} className="text-center py-4 rounded-2xl"
                        style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                        <p className="text-2xl font-bold font-en" style={{ color: s.color }}>{s.n}</p>
                        <p className="text-xs text-gray-500 font-sarabun mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>

            {/* ── Section 2: Flow ── */}
            <div ref={el => sectionRefs.current['flow'] = el}>
              <Section id="flow" title="⚡ วิธีใช้งาน 3 ขั้นตอน">
                <div className="space-y-3">
                  {[
                    { n: '1', title: 'กด "เริ่มสร้าง" บนหน้าแรก', desc: 'เข้าสู่ Workspace ทันที ไม่ต้องสมัครสมาชิก', color: '#5E9BEB' },
                    { n: '2', title: 'เลือก Ranger จากรายการซ้าย', desc: 'คลิก Ranger ที่ตรงกับงาน เช่น Content Creator สำหรับเขียนโพสต์', color: '#A78BFA' },
                    { n: '3', title: 'พิมพ์หรือพูดสั่งงาน', desc: 'บอกโจทย์เป็นภาษาไทย Ranger จะตอบกลับทันที ผ่าน 6-Layer Quality Check', color: '#34D399' },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-4 p-5 rounded-2xl"
                      style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold font-en flex-shrink-0"
                        style={{ background: s.color, color: '#fff', boxShadow: `0 4px 12px ${s.color}50` }}>
                        {s.n}
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm mb-1">{s.title}</p>
                        <p className="text-gray-500 text-sm font-sarabun leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 rounded-2xl border" style={{ borderColor: '#e0e7ff', background: '#f0f4ff' }}>
                  <p className="text-xs font-semibold text-indigo-500 mb-2">💡 เคล็ดลับ</p>
                  <p className="text-sm text-indigo-700 font-sarabun leading-relaxed">
                    กด ⚙ ในช่อง input เพื่อตั้งค่าข้อมูลแบรนด์ ระบบจะตอบตรงกับแบรนด์ของคุณได้ดียิ่งขึ้น
                  </p>
                </div>
              </Section>
            </div>

            {/* ── Section 3: Rangers ── */}
            <div ref={el => sectionRefs.current['rangers'] = el}>
              <Section id="rangers" title="🤖 10 Rangers · 3 กลุ่ม">
                <div className="space-y-4">
                  {CLUSTERS.map(({ icon: Icon, color, name, nameTh, agents }) => (
                    <div key={name} className="rounded-2xl p-5"
                      style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: color + '20' }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 text-sm">{nameTh}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-en"
                            style={{ background: color + '15', color }}>{name}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {agents.map(a => (
                          <div key={a.name} className="flex items-start gap-2.5">
                            <span className="text-base flex-shrink-0 mt-0.5">{a.emoji}</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-600">{a.name}</p>
                              <p className="text-xs text-gray-400 font-sarabun leading-relaxed">{a.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* ── Section 4: Data Guard ── */}
            <div ref={el => sectionRefs.current['dataguard'] = el}>
              <Section id="dataguard" title="🛡️ 6-Layer Data Guard System">
                <div className="mb-4 p-4 rounded-2xl"
                  style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                  <p className="text-sm text-slate-600 font-sarabun leading-relaxed">
                    ทุกคำตอบที่ Rangers สร้างจะผ่านการตรวจสอบ 6 ชั้น ก่อนแสดงผลให้คุณ
                    เพื่อให้ผลลัพธ์มีคุณภาพ ปลอดภัย และตรงกับแบรนด์ของคุณ
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DATA_GUARD_LAYERS.map(layer => (
                    <div key={layer.num} className="p-4 rounded-2xl"
                      style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold font-en px-2 py-0.5 rounded-full"
                          style={{ background: layer.color + '18', color: layer.color }}>
                          Layer {layer.num}
                        </span>
                        <Shield className="w-3.5 h-3.5" style={{ color: layer.color }} />
                      </div>
                      <p className="font-semibold text-slate-700 text-sm mb-1">{layer.name}</p>
                      <p className="text-xs text-gray-400 font-sarabun leading-relaxed">{layer.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* ── Section 5: Features ── */}
            <div ref={el => sectionRefs.current['features'] = el}>
              <Section id="features" title="✨ ฟีเจอร์พิเศษ">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: <Mic className="w-5 h-5"/>, color: '#5E9BEB', title: 'Voice Input', titleTh: 'พูดภาษาไทยได้เลย',
                      desc: 'กดปุ่ม 🎤 แล้วพูดคำสั่ง รองรับภาษาไทย/อังกฤษ\nต้องใช้ Chrome หรือ Edge' },
                    { icon: <Paperclip className="w-5 h-5"/>, color: '#A78BFA', title: 'File Attach', titleTh: 'แนบไฟล์ได้',
                      desc: 'แนบ JPG, PNG, PDF, Word, Text\nขนาดสูงสุด 10MB ต่อไฟล์' },
                    { icon: <Sparkles className="w-5 h-5"/>, color: '#34D399', title: 'Smart Routing', titleTh: 'AI เลือก Agent อัตโนมัติ',
                      desc: 'Orchestrator วิเคราะห์คำสั่ง\nแล้วส่งงานไปยัง Agent ที่เหมาะสม' },
                    { icon: <Shield className="w-5 h-5"/>, color: '#F59E0B', title: '6-Layer Guard', titleTh: 'คุณภาพทุกคำตอบ',
                      desc: 'ตรวจสอบ Fact, USP, Tone\nป้องกัน Hallucination และ Copycat' },
                  ].map((f, i) => (
                    <div key={i} className="p-5 rounded-2xl"
                      style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: f.color + '20', color: f.color }}>
                        {f.icon}
                      </div>
                      <p className="font-bold text-slate-700 text-sm">{f.title}</p>
                      <p className="text-xs text-gray-400 mb-2 font-sarabun">{f.titleTh}</p>
                      <p className="text-sm text-gray-500 font-sarabun leading-relaxed whitespace-pre-line">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* ── Section 6: FAQ ── */}
            <div ref={el => sectionRefs.current['faq'] = el}>
              <Section id="faq" title="💬 คำถามที่พบบ่อย">
                <div className="space-y-2">
                  {FAQS.map((faq, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden"
                      style={{ background: '#EFF2F9', boxShadow: '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff' }}>
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left">
                        <span className="text-slate-600 text-sm font-sarabun font-medium pr-4">{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                      </button>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-5 pb-4 pt-1 text-gray-500 text-sm font-sarabun leading-relaxed border-t border-gray-200">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* CTA */}
            <div className="text-center pt-4 pb-10">
              <div className="inline-block rounded-3xl p-8"
                style={{ background: '#EFF2F9', boxShadow: '8px 8px 20px #d1d9e6, -8px -8px 20px #ffffff' }}>
                <p className="text-3xl mb-3">🚀</p>
                <p className="font-bold text-slate-700 text-lg mb-1">พร้อมแล้ว!</p>
                <p className="text-gray-400 text-sm font-sarabun mb-5">เลือก Ranger แล้วเริ่มทำงานได้เลย</p>
                <motion.button onClick={onStartChat}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 text-white font-semibold px-7 py-3 rounded-2xl text-sm"
                  style={{ background: '#5E9BEB' }}>
                  เริ่มใช้งาน Agent Ranger <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
