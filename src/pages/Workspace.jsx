import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Paperclip, Mic, X, AlertCircle, BookOpen, Check,
    Trash2, LogOut, User, FileText, Copy, Download,
    Sparkles, LayoutGrid, Plus, ChevronDown,
    Building2
} from 'lucide-react';
import { getAllAgents } from '../data/agents';
import { aiService } from '../services/aiService';
import { databaseService } from '../services/databaseService';

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */
const BG = '#F3F6FA'; // A clean slate background matching the reference
const NEU = {
    raised: { boxShadow: '7px 7px 14px #d4dceb, -7px -7px 14px #ffffff', border: '1px solid rgba(255,255,255,0.7)' },
    raisedSm: { boxShadow: '4px 4px 10px #d4dceb, -4px -4px 10px #ffffff', border: '1px solid rgba(255,255,255,0.8)' },
    raisedXs: { boxShadow: '2px 2px 6px #d4dceb, -2px -2px 6px #ffffff', border: '1px solid rgba(255,255,255,0.5)' },
    inset: { boxShadow: 'inset 5px 5px 10px #d4dceb, inset -5px -5px 10px #ffffff' }, // Smooth deep inset
    insetSm: { boxShadow: 'inset 3px 3px 6px #d4dceb, inset -3px -3px 6px #ffffff' },
    insetXs: { boxShadow: 'inset 2px 2px 4px #d4dceb, inset -2px -2px 4px #ffffff' },
};

const INDUSTRY_OPTIONS = [
    { value: '', label: '— เลือกประเภทธุรกิจ —' },
    { value: 'food_beverage', label: '🍜  อาหาร & เครื่องดื่ม' },
    { value: 'beauty_health', label: '💄  ความงาม & สุขภาพ' },
    { value: 'fashion', label: '👗  แฟชั่น & เครื่องแต่งกาย' },
    { value: 'realestate', label: '🏠  อสังหาริมทรัพย์' },
    { value: 'technology', label: '💻  เทคโนโลยี & ซอฟต์แวร์' },
    { value: 'education', label: '📚  การศึกษา & อบรม' },
    { value: 'travel', label: '✈️  ท่องเที่ยว & โรงแรม' },
    { value: 'other', label: '✏️  อื่นๆ (ระบุเอง)' },
];

const TONE_OPTIONS = ['professional', 'casual', 'playful', 'formal', 'luxury'];

const RANGERS = [
    { id: 'brand', name: 'น้องแบรนด์', nameEn: 'Brand Ranger', img: 'https://ik.imagekit.io/ideas365logo/branding.png', color: '#3B82F6', description: 'วิเคราะห์และสร้างกลยุทธ์แบรนด์', keywords: ['brand', 'identity', 'branding'] }, // 1. ฟ้าเข้ม
    { id: 'content', name: 'น้องคอนเทนต์', nameEn: 'Content Ranger', img: 'https://ik.imagekit.io/ideas365logo/content.png', color: '#10B981', description: 'สร้างคอนเทนต์ โพสต์ แคปชั่น', keywords: ['content', 'post', 'caption'] }, // 2. เขียว
    { id: 'planning', name: 'น้องแพลน', nameEn: 'Planning Ranger', img: 'https://ik.imagekit.io/ideas365logo/planning.png', color: '#EAB308', description: 'วางแผนโปรเจกต์และตารางงาน', keywords: ['plan', 'schedule', 'roadmap'] }, // 3. เหลือง
    { id: 'marketing', name: 'น้องดูตลาด', nameEn: 'Marketing Ranger', img: 'https://ik.imagekit.io/ideas365logo/marketing.png', color: '#EF4444', description: 'วิเคราะห์ตลาด คู่แข่ง เทรนด์', keywords: ['market', 'research', 'trend'] }, // 4. แดง
    { id: 'consult', name: 'น้องที่ปรึกษา', nameEn: 'Consultant Ranger', img: 'https://ik.imagekit.io/ideas365logo/consult.png', color: '#F97316', description: 'ให้คำปรึกษาธุรกิจและกลยุทธ์', keywords: ['consult', 'advice', 'strategy'] }, // 5. ส้ม
    { id: 'what', name: 'น้องงง', nameEn: 'WHAT?!', img: 'https://ik.imagekit.io/ideas365logo/what.png', color: '#EC4899', description: 'Coming Soon…', keywords: [], comingSoon: true }, // 6. ชมพู
];

/* ═══════════════════════════════════════════════════
   FONT LOADER
═══════════════════════════════════════════════════ */
const FontLoader = () => {
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        const style = document.createElement('style');
        style.textContent = `
      *, *::before, *::after { font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif !important; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #d1d9e6; border-radius: 99px; }
    `;
        document.head.appendChild(style);
    }, []);
    return null;
};

/* ═══════════════════════════════════════════════════
   MARKDOWN RENDERER
═══════════════════════════════════════════════════ */
const renderInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ fontWeight: 700, color: '#1e293b' }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: '#e2e8f0', color: '#1e3a5f', padding: '0 4px', borderRadius: 4, fontSize: '0.8em' }}>{part.slice(1, -1)}</code>;
        return part;
    });
};
const MarkdownText = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n'); const els = []; let k = 0;
    for (const line of lines) {
        if (line.startsWith('### ')) els.push(<div key={k++} style={{ fontWeight: 700, color: '#1e293b', margin: '12px 0 4px', fontSize: '0.85rem' }}>{renderInline(line.slice(4))}</div>);
        else if (line.startsWith('## ')) els.push(<div key={k++} style={{ fontWeight: 700, color: '#1e293b', margin: '12px 0 4px', fontSize: '0.9rem' }}>{renderInline(line.slice(3))}</div>);
        else if (/^[\s]*[-•*]\s/.test(line) || /^\s*\d+\.\s/.test(line))
            els.push(<div key={k++} style={{ display: 'flex', gap: 8, margin: '2px 0', paddingLeft: 8 }}><span style={{ color: '#94a3b8', flexShrink: 0 }}>›</span><span>{renderInline(line.replace(/^[\s]*[-•*]\s/, '').replace(/^\s*\d+\.\s/, ''))}</span></div>);
        else if (line.trim() === '---') els.push(<hr key={k++} style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />);
        else if (line.trim() === '') els.push(<div key={k++} style={{ height: 4 }} />);
        else els.push(<div key={k++} style={{ margin: '2px 0', lineHeight: 1.65 }}>{renderInline(line)}</div>);
    }
    return <div style={{ fontSize: '0.85rem', color: '#475569' }}>{els}</div>;
};

/* ═══════════════════════════════════════════════════
   HOISTED: COMING SOON MODAL
═══════════════════════════════════════════════════ */
const ComingSoonModal = ({ onClose }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}>
        <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: BG, borderRadius: 28, padding: '36px 32px', maxWidth: 360, width: '90%', textAlign: 'center', ...NEU.raised }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', marginBottom: 8 }}>Coming Soon!</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: 24 }}>น้องงง กำลังจะมาเร็วๆ นี้ค่ะ<br />ตอนนี้กำลังเตรียมความพร้อมอยู่นะคะ 🎉</p>
            <button onClick={onClose} style={{ background: 'linear-gradient(135deg,#6C63FF 0%,#FF6B9D 100%)', color: '#fff', border: 'none', borderRadius: 99, padding: '10px 32px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(108,99,255,0.35)' }}>รับทราบค่ะ ✨</button>
        </motion.div>
    </div>
);

/* ═══════════════════════════════════════════════════
   HOISTED: GUIDEBOOK MODAL
═══════════════════════════════════════════════════ */
const GuidebookModal = ({ onClose }) => {
    const rangers = RANGERS.filter(r => !r.comingSoon);
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.28 }}
                style={{ background: BG, borderRadius: 28, width: '90%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', ...NEU.raised, overflow: 'hidden' }}>
                <div style={{ padding: '22px 26px 14px', borderBottom: '1px solid rgba(209,217,230,0.6)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: BG, borderRadius: 14, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', ...NEU.raisedSm, flexShrink: 0 }}>
                        <BookOpen size={19} color="#5E9BEB" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>คู่มือการใช้งาน Agent Rangers</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>iDEAS365 × STRATEGIC AI</div>
                    </div>
                    <button onClick={onClose} style={{ background: BG, border: 'none', borderRadius: 11, padding: 7, cursor: 'pointer', ...NEU.raisedXs, color: '#94a3b8' }}><X size={15} /></button>
                </div>
                <div style={{ overflowY: 'auto', padding: '18px 26px 26px', flex: 1 }}>
                    <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.75, marginBottom: 18 }}>
                        Agent Rangers คือทีม AI ผู้ช่วยส่วนตัวที่ออกแบบมาเพื่อช่วยคุณในทุกด้านของธุรกิจและการตลาด แต่ละตัวมีความเชี่ยวชาญเฉพาะด้านค่ะ
                    </p>
                    {rangers.map(r => (
                        <div key={r.id} style={{ background: BG, borderRadius: 18, padding: '14px 16px', marginBottom: 12, ...NEU.raisedSm, borderLeft: `3px solid ${r.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <img src={r.img} alt={r.name} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10, background: r.color + '12', padding: 4 }} onError={e => { e.target.style.display = 'none' }} />
                                <div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{r.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: r.color, fontWeight: 600 }}>{r.nameEn}</div>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.7, margin: 0 }}>{r.description} — เหมาะสำหรับงานด้าน {r.keywords.slice(0, 3).join(', ')}</p>
                        </div>
                    ))}
                    <div style={{ background: 'linear-gradient(135deg,#EEF2FF 0%,#FCE7F3 100%)', borderRadius: 16, padding: '14px 18px', marginTop: 6 }}>
                        <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.83rem', marginBottom: 8 }}>💡 เคล็ดลับการใช้งาน</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#64748b', lineHeight: 2 }}>
                            <li>กรอกข้อมูลแบรนด์ใน Panel ขวา เพื่อให้ Ranger ตอบได้ตรงจุดมากขึ้น</li>
                            <li>ระบุบริบทให้ชัดเจน เช่น "สร้างแคปชั่น IG สำหรับสินค้า X ราคา Y"</li>
                            <li>แนบไฟล์/รูป/PDF ได้สูงสุด 5 ไฟล์ต่อครั้ง</li>
                            <li>ใช้ Voice Mode พูดภาษาไทยได้เลย ไม่ต้องพิมพ์ค่ะ</li>
                        </ul>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════
   HOISTED: RANGER CARD (Panel 1)
═══════════════════════════════════════════════════ */
const RangerCard = React.memo(({ ranger, isActive, msgCount, onClick }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <motion.button onClick={onClick} whileTap={{ scale: 0.95 }}
            style={{
                background: BG, border: 'none', borderRadius: 24, aspectRatio: '1/1', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all 0.3s ease',
                ...(isActive ? { ...NEU.inset } : { ...NEU.raisedSm }),
                opacity: ranger.comingSoon ? 0.75 : 1, width: '100%'
            }}>

            {/* 🔴 Top Right Status Dot using agent's specific color */}
            <span style={{
                position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%',
                background: isActive ? ranger.color : '#cbd5e1',
                boxShadow: isActive ? `0 0 6px ${ranger.color}` : 'none'
            }} />

            {/* Bottom Color Line (Visible only if active) */}
            {isActive && (
                <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 4, background: ranger.color, borderRadius: '4px 4px 0 0' }} />
            )}

            {/* Unread badge */}
            {!isActive && msgCount > 1 && (
                <span style={{ position: 'absolute', top: 8, right: 8, minWidth: 16, height: 16, borderRadius: 99, background: ranger.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {msgCount > 99 ? '99+' : msgCount}
                </span>
            )}

            {/* 🟦 Center Icon (No colored background box anymore!) */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {!imgError
                    ? <img src={ranger.img} alt={ranger.name} style={{ width: '95%', height: '95%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} onError={() => setImgError(true)} />
                    : <span style={{ fontSize: 24 }}>🤖</span>}
            </div>
        </motion.button>
    );
});
RangerCard.displayName = 'RangerCard';

/* ═══════════════════════════════════════════════════
   HOISTED: PAST SESSION ROW (Panel 1)
═══════════════════════════════════════════════════ */
const PastSessionRow = React.memo(({ ranger, messages, isActive, onClick }) => {
    const lastUser = [...messages].reverse().find(m => m.sender === 'user');
    const lastTs = messages[messages.length - 1]?.timestamp;
    const timeStr = lastTs ? (lastTs instanceof Date ? lastTs : new Date(lastTs)).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
        <motion.button onClick={onClick} whileTap={{ scale: 0.97 }}
            style={{ width: '100%', background: isActive ? BG : 'transparent', border: 'none', borderRadius: 13, padding: '8px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', transition: 'all 0.2s', ...(isActive ? NEU.insetXs : {}) }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: (ranger?.color || '#5E9BEB') + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <img src={ranger?.img} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ranger?.color || '#5E9BEB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 96 }}>{ranger?.name}</span>
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8', flexShrink: 0 }}>{timeStr}</span>
                </div>
                <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
                    {lastUser?.text?.slice(0, 42) || 'เริ่มบทสนทนา...'}
                </p>
            </div>
        </motion.button>
    );
});
PastSessionRow.displayName = 'PastSessionRow';

/* ═══════════════════════════════════════════════════
   HOISTED: OUTPUT CARD (Panel 3 — File Work)
═══════════════════════════════════════════════════ */
const OutputCard = ({ output, index }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => { navigator.clipboard.writeText(output.content || output.text || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); };
    const handleDownload = () => {
        const content = output.content || output.text || '';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(output.title || 'output').replace(/[^a-zA-Zก-๙0-9\s]/g, '_').trim()}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const icons = { image: '🖼️', code: '💻', report: '📊', document: '📄', default: '📝' };
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
            style={{ background: BG, borderRadius: 16, overflow: 'hidden', ...NEU.raisedSm, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: '1px solid rgba(209,217,230,0.5)' }}>
                <span style={{ fontSize: 14 }}>{icons[output.type] || icons.default}</span>
                <span style={{ flex: 1, fontSize: '0.76rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{output.title || 'ผลลัพธ์'}</span>
                <button onClick={handleDownload} title="ดาวน์โหลด" style={{ background: BG, border: 'none', borderRadius: 7, padding: 4, cursor: 'pointer', color: '#94a3b8', ...NEU.raisedXs }}>
                    <Download size={11} />
                </button>
                <button onClick={handleCopy} title="คัดลอก" style={{ background: BG, border: 'none', borderRadius: 7, padding: 4, cursor: 'pointer', color: '#94a3b8', ...NEU.raisedXs }}>
                    {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                </button>
            </div>
            <div style={{ padding: '9px 11px' }}>
                {output.type === 'image' && output.url
                    ? <img src={output.url} alt={output.title} style={{ width: '100%', borderRadius: 9, objectFit: 'cover', maxHeight: 110 }} />
                    : <p style={{ fontSize: '0.76rem', color: '#64748b', margin: 0, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{output.content || output.text || ''}</p>
                }
                {output.agentName && <p style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 5, marginBottom: 0 }}>by {output.agentName}</p>}
            </div>
        </motion.div>
    );
};

/* ═══════════════════════════════════════════════════
   HOISTED: BRAND POPUP MODAL (3 brands, popup style)
═══════════════════════════════════════════════════ */
const emptyBrand = () => ({
    id: Date.now() + Math.random(),
    name: '', nameEn: '', industry: '', industryOther: '',
    usp: '', audience: '', tone: 'professional',
    competitors: '', painPoints: '', targetPersona: '',
    forbiddenWords: '', primaryColor: '#5E9BEB', moodKeywords: '',
});

const BrandPopupModal = ({ brands, activeBrandIdx, onSave, onClose }) => {
    const [localBrands, setLocalBrands] = useState(() => brands.length ? brands.map(b => ({ ...b })) : [emptyBrand()]);
    const [activeIdx, setActiveIdx] = useState(activeBrandIdx || 0);
    const [saved, setSaved] = useState(false);

    const brand = localBrands[activeIdx] || localBrands[0];
    const showOther = brand?.industry === 'other';

    const updateField = (key, val) =>
        setLocalBrands(prev => prev.map((b, i) => i === activeIdx ? { ...b, [key]: val } : b));

    const handleAdd = () => {
        if (localBrands.length >= 3) return;
        setLocalBrands(prev => [...prev, emptyBrand()]);
        setActiveIdx(localBrands.length);
    };

    const handleRemove = (idx) => {
        if (localBrands.length <= 1) return;
        const next = localBrands.filter((_, i) => i !== idx);
        setLocalBrands(next);
        setActiveIdx(prev => Math.max(0, prev >= next.length ? next.length - 1 : prev));
    };

    const handleSave = () => {
        onSave(localBrands, activeIdx);
        // Sync ทุก brand ไป Neon DB (fire-and-forget)
        localBrands.forEach(b => {
            if (!b.name) return;
            const ind = b.industry === 'other' ? (b.industryOther || 'other') : (b.industry || 'other');
            databaseService.saveBrand({
                brandNameTh: b.name,
                brandNameEn: b.nameEn || b.name,
                industry: ind,
                coreUsp: b.usp ? b.usp.split(',').map(s => s.trim()).filter(Boolean) : [],
                competitors: b.competitors ? b.competitors.split(',').map(s => s.trim()).filter(Boolean) : [],
                targetAudience: b.audience || '',
                targetPersona: b.targetPersona || '',
                painPoints: b.painPoints ? b.painPoints.split(',').map(s => s.trim()).filter(Boolean) : [],
                toneOfVoice: b.tone || 'professional',
                forbiddenWords: b.forbiddenWords ? b.forbiddenWords.split(',').map(s => s.trim()).filter(Boolean) : [],
                primaryColor: b.primaryColor || '#5E9BEB',
                moodKeywords: b.moodKeywords ? b.moodKeywords.split(',').map(s => s.trim()).filter(Boolean) : [],
            }).catch(() => {});
        });
        setSaved(true);
        setTimeout(() => { setSaved(false); onClose(); }, 800);
    };

    const S = {
        inp: { width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '9px 12px', fontSize: '0.82rem', color: '#334155', boxSizing: 'border-box', fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif" },
        wrap: { background: BG, borderRadius: 12, ...NEU.insetXs, marginBottom: 10 },
        label: { fontSize: '0.68rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
        sel: { width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '9px 32px 9px 12px', fontSize: '0.82rem', color: '#334155', boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif" },
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 16 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: BG, borderRadius: 28, width: '90%', maxWidth: 460, maxHeight: '88vh', display: 'flex', flexDirection: 'column', ...NEU.raised, overflow: 'hidden' }}>

                {/* ── Header ── */}
                <div style={{ flexShrink: 0, padding: '20px 24px 14px', borderBottom: '1px solid rgba(209,217,230,0.6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ background: BG, borderRadius: 14, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', ...NEU.raisedSm, flexShrink: 0 }}>
                            <Building2 size={18} color="#5E9BEB" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>ข้อมูลแบรนด์</div>
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 1 }}>Rangers จะนำข้อมูลนี้ไปใช้เพื่อให้ผลลัพธ์ตรงกับแบรนด์ของคุณ</div>
                        </div>
                        <button onClick={onClose} style={{ background: BG, border: 'none', borderRadius: 11, padding: 7, cursor: 'pointer', ...NEU.raisedXs, color: '#94a3b8', flexShrink: 0 }}><X size={14} /></button>
                    </div>

                    {/* Brand tabs */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {localBrands.map((b, idx) => (
                            <button key={b.id} onClick={() => setActiveIdx(idx)}
                                style={{
                                    flex: 1, padding: '7px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, transition: 'all 0.2s', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                                    ...(activeIdx === idx ? { background: '#5E9BEB', color: '#fff', boxShadow: '2px 2px 8px rgba(94,155,235,0.3)' } : { background: BG, color: '#64748b', ...NEU.raisedXs })
                                }}>
                                {b.name || `แบรนด์ ${idx + 1}`}
                            </button>
                        ))}
                        {localBrands.length < 3 && (
                            <button onClick={handleAdd}
                                style={{ width: 34, height: 34, borderRadius: 12, border: 'none', cursor: 'pointer', background: BG, color: '#5E9BEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...NEU.raisedXs }}>
                                <Plus size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 6px' }}>
                    {/* Recommendation notice */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'linear-gradient(135deg,#EEF2FF,#F0FDF4)', borderRadius: 14, padding: '11px 14px', marginBottom: 18, border: '1px solid rgba(99,102,241,0.12)' }}>
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#4338ca', lineHeight: 1.7 }}>
                            <strong>แนะนำให้กรอกข้อมูลให้ครบถ้วนทุกช่อง</strong> เพื่อให้ Rangers สร้างผลลัพธ์ที่สอดคล้องกับแบรนด์ของคุณได้อย่างมีประสิทธิภาพสูงสุด
                            <span style={{ color: '#6366f1', fontWeight: 500 }}> (การกรอกข้อมูลไม่เป็นข้อบังคับ)</span>
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
                        <div>
                            <label style={S.label}>ชื่อแบรนด์ (ภาษาไทย)</label>
                            <div style={S.wrap}><input style={S.inp} value={brand.name} onChange={e => updateField('name', e.target.value)} placeholder="เช่น บริษัทดีดี จำกัด" /></div>
                        </div>
                        <div>
                            <label style={S.label}>Brand Name (English)</label>
                            <div style={S.wrap}><input style={S.inp} value={brand.nameEn} onChange={e => updateField('nameEn', e.target.value)} placeholder="e.g. DeeD Co., Ltd." /></div>
                        </div>
                    </div>

                    <label style={S.label}>ประเภทธุรกิจ</label>
                    <div style={{ ...S.wrap, position: 'relative' }}>
                        <select value={brand.industry} onChange={e => updateField('industry', e.target.value)} style={S.sel}>
                            {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    {showOther && (
                        <div style={{ ...S.wrap, marginTop: -6 }}>
                            <input style={S.inp} value={brand.industryOther} onChange={e => updateField('industryOther', e.target.value)} placeholder="โปรดระบุประเภทธุรกิจของคุณ..." />
                        </div>
                    )}

                    <label style={S.label}>จุดขายหลัก / ความโดดเด่นของแบรนด์ (USP)</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.usp} onChange={e => updateField('usp', e.target.value)} placeholder="เช่น ส่งเร็วทั่วไทยภายใน 24 ชั่วโมง, วัตถุดิบออร์แกนิก 100%" /></div>

                    <label style={S.label}>กลุ่มเป้าหมายหลัก</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.audience} onChange={e => updateField('audience', e.target.value)} placeholder="เช่น ผู้หญิงวัยทำงาน อายุ 25–35 ปี รายได้ปานกลาง-สูง" /></div>

                    <label style={S.label}>โทนเสียง / บุคลิกแบรนด์ (Tone of Voice)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                        {TONE_OPTIONS.map(t => (
                            <button key={t} onClick={() => updateField('tone', t)}
                                style={{
                                    padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, transition: 'all 0.2s',
                                    ...(brand.tone === t ? { background: '#5E9BEB', color: '#fff', boxShadow: '2px 2px 8px rgba(94,155,235,0.28)' } : { background: BG, color: '#64748b', ...NEU.raisedXs })
                                }}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* ── Extended Brand Fields ── */}
                    <label style={S.label}>คู่แข่งหลัก (ถ้ามี)</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.competitors || ''} onChange={e => updateField('competitors', e.target.value)} placeholder="เช่น ร้าน A, ร้าน B (คั่นด้วยจุลภาค)" /></div>

                    <label style={S.label}>ปัญหาที่ลูกค้าเจอ (Pain Points)</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.painPoints || ''} onChange={e => updateField('painPoints', e.target.value)} placeholder="เช่น หาคุณภาพดีราคาไม่แพงยาก, ไม่รู้จะเริ่มยังไง" /></div>

                    <label style={S.label}>Persona ลูกค้าโดยละเอียด</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.targetPersona || ''} onChange={e => updateField('targetPersona', e.target.value)} placeholder="เช่น ผู้หญิง อายุ 28-38 ปี ทำงานออฟฟิศ รายได้ 30,000+ บาท" /></div>

                    <label style={S.label}>คำที่ห้ามใช้</label>
                    <div style={S.wrap}><input style={S.inp} value={brand.forbiddenWords || ''} onChange={e => updateField('forbiddenWords', e.target.value)} placeholder="เช่น ถูก, ราคาตลาด, ธรรมดา (คั่นด้วยจุลภาค)" /></div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
                        <div>
                            <label style={S.label}>สีแบรนด์หลัก</label>
                            <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
                                <input type="color" value={brand.primaryColor || '#5E9BEB'} onChange={e => updateField('primaryColor', e.target.value)}
                                    style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 6 }} />
                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>{brand.primaryColor || '#5E9BEB'}</span>
                            </div>
                        </div>
                        <div>
                            <label style={S.label}>Mood & Feel</label>
                            <div style={S.wrap}><input style={S.inp} value={brand.moodKeywords || ''} onChange={e => updateField('moodKeywords', e.target.value)} placeholder="เช่น อบอุ่น, ทันสมัย" /></div>
                        </div>
                    </div>

                    {localBrands.length > 1 && (
                        <button onClick={() => handleRemove(activeIdx)}
                            style={{ width: '100%', padding: '9px', borderRadius: 13, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#f87171', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                            <Trash2 size={13} /> ลบแบรนด์นี้ออกจากรายการ
                        </button>
                    )}
                </div>

                {/* ── Footer ── */}
                <div style={{ flexShrink: 0, padding: '14px 24px 20px', borderTop: '1px solid rgba(209,217,230,0.5)', display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 15, border: 'none', background: BG, color: '#64748b', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', ...NEU.raisedSm }}>ยกเลิก</button>
                    <button onClick={handleSave}
                        style={{
                            flex: 2, padding: '11px', borderRadius: 15, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s',
                            background: saved ? '#10b981' : 'linear-gradient(135deg,#5E9BEB 0%,#6C63FF 100%)',
                            boxShadow: saved ? '0 4px 12px rgba(16,185,129,0.3)' : '3px 3px 10px rgba(94,155,235,0.3)'
                        }}>
                        <Check size={15} /> {saved ? 'บันทึกแล้ว!' : 'บันทึกข้อมูล'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN WORKSPACE
═══════════════════════════════════════════════════ */
export const Workspace = ({ masterContext, onContextUpdate, currentUser }) => {

    /* ─── State ─── */
    const [selectedId, setSelectedId] = useState(() => {
        try { return sessionStorage.getItem('ranger_selectedAgent') || null; } catch { return null; }
    });
    const [chatSessions, setChatSessions] = useState(() => {
        try {
            const s = sessionStorage.getItem('ranger_chats');
            if (!s) return {};
            const p = JSON.parse(s);
            Object.values(p).forEach(msgs => msgs.forEach(m => { if (m.timestamp) m.timestamp = new Date(m.timestamp); }));
            return p;
        } catch { return {}; }
    });
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [previewUrls, setPreviewUrls] = useState({});
    const [outputs, setOutputs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('ranger_outputs') || '[]'); } catch { return []; }
    });
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [showGuidebook, setShowGuidebook] = useState(false);
    const [showBrandModal, setShowBrandModal] = useState(false);
    /* Panel 3 sections */
    const [p3Tab, setP3Tab] = useState('files'); // 'files' | 'brand'

    /* Brand management: up to 3 brands */
    const [brands, setBrands] = useState(() => {
        try {
            const saved = localStorage.getItem('ranger_brands');
            if (saved) return JSON.parse(saved);
        } catch { }
        // init from masterContext if available
        return [emptyBrand()];
    });
    const [activeBrandIdx, setActiveBrandIdx] = useState(0);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const selectedRanger = RANGERS.find(r => r.id === selectedId);
    const currentMessages = chatSessions[selectedId] || [];
    const activeBrand = brands[activeBrandIdx] || brands[0];
    const hasBrand = activeBrand?.name?.trim();

    /* past sessions */
    const activeSessions = RANGERS
        .filter(r => !r.comingSoon && (chatSessions[r.id]?.length || 0) > 1)
        .sort((a, b) => {
            const ta = chatSessions[a.id]?.slice(-1)[0]?.timestamp || 0;
            const tb = chatSessions[b.id]?.slice(-1)[0]?.timestamp || 0;
            return new Date(tb) - new Date(ta);
        });

    /* ─── Effects ─── */
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const r = new SpeechRecognition();
            r.continuous = false; r.interimResults = true; r.lang = 'th-TH';
            r.onstart = () => setIsListening(true);
            r.onend = () => setIsListening(false);
            r.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; if (t) setInputValue(t); };
            r.onerror = () => setIsListening(false);
            recognitionRef.current = r;
        }
    }, []);

    useEffect(() => {
        if (masterContext) aiService.initialize(masterContext);
    }, [masterContext]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentMessages, isLoading]);

    useEffect(() => {
        try { sessionStorage.setItem('ranger_chats', JSON.stringify(chatSessions)); } catch {
            const t = {}; Object.entries(chatSessions).forEach(([k, v]) => { t[k] = v.slice(-20); }); sessionStorage.setItem('ranger_chats', JSON.stringify(t));
        }
    }, [chatSessions]);

    useEffect(() => { if (selectedId) sessionStorage.setItem('ranger_selectedAgent', selectedId); }, [selectedId]);
    useEffect(() => { if (outputs.length > 0) setRightPanelOpen(true); }, [outputs.length]);

    /* Persist outputs to localStorage (เก็บล่าสุด 30 รายการ) */
    useEffect(() => {
        try { localStorage.setItem('ranger_outputs', JSON.stringify(outputs.slice(-30))); } catch {}
    }, [outputs]);

    /* Sync active brand → masterContext */
    useEffect(() => {
        if (!hasBrand) return;
        const ctx = buildContext(activeBrand);
        onContextUpdate?.(ctx);
        aiService.initialize(ctx);
    }, [activeBrandIdx, brands]);

    /* Load brands from Neon DB on mount (merge กับ localStorage) */
    useEffect(() => {
        databaseService.getBrands().then(dbBrands => {
            if (!dbBrands?.length) return;
            setBrands(prev => {
                let merged = [...prev];
                dbBrands.forEach(db => {
                    const already = merged.find(b => b.name === db.brandNameTh || String(b.id) === String(db.id));
                    if (!already && merged.length < 3) {
                        merged.push({
                            id: db.id || Date.now(),
                            name: db.brandNameTh || '',
                            nameEn: db.brandNameEn || '',
                            industry: db.industry || '',
                            industryOther: '',
                            usp: Array.isArray(db.coreUsp) ? db.coreUsp.join(', ') : (db.coreUsp || ''),
                            audience: db.targetAudience || '',
                            tone: db.toneOfVoice || 'professional',
                            competitors: Array.isArray(db.competitors) ? db.competitors.join(', ') : '',
                            painPoints: Array.isArray(db.painPoints) ? db.painPoints.join(', ') : '',
                            targetPersona: db.targetPersona || '',
                            forbiddenWords: Array.isArray(db.forbiddenWords) ? db.forbiddenWords.join(', ') : '',
                            primaryColor: db.primaryColor || '#5E9BEB',
                            moodKeywords: Array.isArray(db.moodKeywords) ? db.moodKeywords.join(', ') : '',
                        });
                    }
                });
                return merged;
            });
        }).catch(() => {});
    }, []);

    /* Persist brands */
    useEffect(() => {
        try { localStorage.setItem('ranger_brands', JSON.stringify(brands)); } catch { }
    }, [brands]);

    /* ─── Brand helpers ─── */
    const buildContext = (b) => ({
        brandId: String(b.id),
        brandNameTh: b.name || 'แบรนด์ของฉัน',
        brandNameEn: b.nameEn || 'My Brand',
        industry: b.industry === 'other'
            ? (b.industryOther || 'ธุรกิจอื่นๆ')
            : (INDUSTRY_OPTIONS.find(o => o.value === b.industry)?.label?.replace(/^.{2}\s*/, '') || b.industry || 'ธุรกิจทั่วไป'),
        // Bucket 1: Strategy
        coreUSP: b.usp ? b.usp.split(',').map(s => s.trim()).filter(Boolean) : [],
        competitors: b.competitors ? b.competitors.split(',').map(s => s.trim()).filter(Boolean) : [],
        // Bucket 2: Visual/Creative
        visualStyle: {
            primaryColor: b.primaryColor || '#5E9BEB',
            moodKeywords: b.moodKeywords ? b.moodKeywords.split(',').map(s => s.trim()).filter(Boolean) : ['professional'],
            secondaryColors: [],
        },
        // Bucket 3: Growth/Communication
        targetAudience: b.audience || '',
        targetPersona: b.targetPersona || '',
        painPoints: b.painPoints ? b.painPoints.split(',').map(s => s.trim()).filter(Boolean) : [],
        toneOfVoice: b.tone || 'professional',
        forbiddenWords: b.forbiddenWords ? b.forbiddenWords.split(',').map(s => s.trim()).filter(Boolean) : [],
        brandHashtags: [],
        // Metadata
        isDefault: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    });

    /* ─── Ranger select ─── */
    const handleSelectRanger = useCallback((ranger) => {
        if (ranger.comingSoon) { setShowComingSoon(true); return; }
        setSelectedId(ranger.id);
        setError(null);
        if (!chatSessions[ranger.id]) {
            setChatSessions(prev => ({
                ...prev,
                [ranger.id]: [{
                    id: Date.now(), sender: 'agent', timestamp: new Date(),
                    text: `สวัสดีค่ะ! ฉันคือ **${ranger.name}** 😊\n\n${ranger.description}\n\nบอกได้เลยค่ะ ต้องการให้ช่วยเรื่องอะไร?`, confidence: 100
                }]
            }));
        }
    }, [chatSessions]);

    /* ─── Send ─── */
    const handleSend = async (e) => {
        e?.preventDefault();
        if ((!inputValue.trim() && attachments.length === 0) || !selectedId || isLoading) return;
        const text = inputValue.trim();
        setInputValue(''); setError(null);
        const userMsg = { id: Date.now(), sender: 'user', text, timestamp: new Date(), attachments: attachments.map(a => ({ name: a.name, type: a.type })) };
        setChatSessions(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), userMsg] }));
        setAttachments([]); setPreviewUrls({});
        setIsLoading(true);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        try {
            const history = (chatSessions[selectedId] || []).filter(m => m.sender !== 'system').map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
            const ctx = hasBrand ? buildContext(activeBrand) : masterContext;
            const response = await aiService.sendMessage(selectedId, text, history, ctx, attachments);
            const agentMsg = { id: Date.now() + 1, sender: 'agent', timestamp: new Date(), text: response.text || response, confidence: response.confidence };
            if (response.outputs?.length) setOutputs(prev => [...prev, ...response.outputs.filter(o => ['document', 'code', 'report', 'image'].includes(o.type))]);
            setChatSessions(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), agentMsg] }));
        } catch (err) {
            setError(err.message || 'เกิดข้อผิดพลาด');
            setChatSessions(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), { id: Date.now() + 1, sender: 'agent', text: `⚠️ ${err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}`, timestamp: new Date(), isError: true }] }));
        } finally { setIsLoading(false); }
    };

    const handleKeyDown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } };
    const handleSpeechToggle = () => { if (!recognitionRef.current) return; if (isListening) recognitionRef.current.stop(); else { setInputValue(''); recognitionRef.current.start(); } };
    const handleFileSelect = e => {
        Array.from(e.target.files || []).forEach(file => {
            if (file.size > 10 * 1024 * 1024) { setError(`ไฟล์ ${file.name} ใหญ่เกินไป`); return; }
            const r = new FileReader();
            r.onload = ev => {
                setAttachments(prev => [...prev, { name: file.name, type: file.type, size: file.size, data: ev.target?.result }]);
                if (file.type.startsWith('image/')) setPreviewUrls(prev => ({ ...prev, [file.name]: ev.target?.result }));
            };
            r.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const removeAttachment = name => { setAttachments(p => p.filter(a => a.name !== name)); setPreviewUrls(p => { const n = { ...p }; delete n[name]; return n; }); };

    /* ─── RENDER ─── */
    return (
        <>
            <FontLoader />
            <style>{`
        @keyframes rangerpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(1.2)} }
        @keyframes typingdot   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>

            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif" }}>

                {/* ══ TOP BAR ══════════════════════════════════════════════════════ */}
                <div style={{ flexShrink: 0, height: 54, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid rgba(209,217,230,0.6)', background: BG, gap: 10, zIndex: 10 }}>
                    {/* Logo */}
                    <img src="https://ik.imagekit.io/ideas365logo/ideas365-logo.png?updatedAt=1771192801056" alt="iDEAS365"
                        style={{ height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    {/* Fallback logo */}
                    <div style={{ display: 'none', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {['#6C63FF', '#FF6B9D', '#0EA5E9'].map((c, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />)}
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#334155' }}>iDEAS365</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#94a3b8', letterSpacing: '0.08em', marginRight: 'auto' }}>AGENT RANGERS</span>

                    {/* Online status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, background: BG, ...NEU.raisedXs }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'rangerpulse 2s infinite', display: 'inline-block' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981' }}>ออนไลน์</span>
                    </div>
                    {/* User */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 99, background: BG, ...NEU.raisedXs }}>
                        <div style={{ width: 21, height: 21, borderRadius: '50%', background: 'linear-gradient(135deg,#6C63FF,#FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={11} color="#fff" />
                        </div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#475569' }}>{currentUser?.name || activeBrand?.name || 'ผู้ใช้'}</span>
                    </div>
                    {/* Guidebook */}
                    <button onClick={() => setShowGuidebook(true)} title="คู่มือ"
                        style={{ background: BG, border: 'none', borderRadius: 11, padding: '6px 9px', cursor: 'pointer', color: '#64748b', ...NEU.raisedXs }}>
                        <BookOpen size={15} />
                    </button>
                    {/* Logout */}
                    <button title="ออกจากระบบ" onClick={() => { if (window.confirm('ออกจากระบบแล้วจะล้างประวัติแชทในเซสชั่นนี้ ต้องการออกจากระบบไหมคะ?')) { sessionStorage.clear(); window.location.reload(); } }}
                        style={{ background: BG, border: 'none', borderRadius: 11, padding: '6px 9px', cursor: 'pointer', color: '#94a3b8', ...NEU.raisedXs }}>
                        <LogOut size={15} />
                    </button>
                </div>

                {/* ══ PANELS ══════════════════════════════════════════════════════ */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                    {/* ── PANEL 1: LEFT ─────────────────────────────────────────── */}
                    <div style={{ width: 330, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.7)', background: BG, overflow: 'hidden' }}>

                        {/* Rangers 3x2 (3 cols 2 rows) grid */}
                        <div style={{ padding: '24px 20px', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20, paddingLeft: 4 }}>RANGERS</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                {RANGERS.map(ranger => (
                                    <RangerCard key={ranger.id} ranger={ranger}
                                        isActive={ranger.id === selectedId}
                                        msgCount={chatSessions[ranger.id]?.length || 0}
                                        onClick={() => handleSelectRanger(ranger)} />
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'rgba(209,217,230,0.5)', margin: '0 10px', flexShrink: 0 }} />

                        {/* Chat History */}
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 8px 6px', minHeight: 0 }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, paddingLeft: 2 }}>บทสนทนาล่าสุด</div>
                            {activeSessions.length > 0 ? (
                                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                                    {activeSessions.slice(0, 7).map(ranger => (
                                        <PastSessionRow key={ranger.id} ranger={ranger}
                                            messages={chatSessions[ranger.id] || []}
                                            isActive={ranger.id === selectedId}
                                            onClick={() => handleSelectRanger(ranger)} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <p style={{ fontSize: '0.7rem', color: '#c4ccd6', textAlign: 'center', lineHeight: 1.7 }}>ยังไม่มีบทสนทนา<br />เลือก Ranger เพื่อเริ่มต้น</p>
                                </div>
                            )}
                        </div>

                        {/* Clear all */}
                        {activeSessions.length > 0 && (
                            <div style={{ flexShrink: 0, padding: '4px 8px 10px' }}>
                                <button onClick={() => { if (!window.confirm('ล้างแชทของทุก Ranger?')) return; const c = {}; Object.entries(chatSessions).forEach(([id, msgs]) => { c[id] = msgs.slice(0, 1); }); setChatSessions(c); sessionStorage.removeItem('ranger_chats'); aiService.clearHistory?.(); }}
                                    style={{ width: '100%', padding: '6px', borderRadius: 11, border: 'none', background: BG, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: '#94a3b8', fontSize: '0.7rem', fontWeight: 500, ...NEU.raisedXs }}>
                                    <Trash2 size={11} /> ล้างแชททั้งหมด
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── PANEL 2: CENTER (CHAT) ─────────────────────────────────── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                        {/* Chat Header */}
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '9px 14px', borderBottom: '1px solid rgba(209,217,230,0.5)', background: BG }}>
                            {selectedRanger ? (
                                <>
                                    <div style={{ width: 34, height: 34, borderRadius: 11, background: selectedRanger.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, ...NEU.raisedXs }}>
                                        <img src={selectedRanger.img} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>{selectedRanger.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'rangerpulse 2s infinite', display: 'inline-block' }} />
                                            {selectedRanger.description}
                                        </div>
                                    </div>
                                    {currentMessages.length > 1 && (
                                        <button onClick={() => { if (!window.confirm('ล้างแชทนี้?')) return; setChatSessions(p => ({ ...p, [selectedId]: [currentMessages[0]] })); }}
                                            style={{ background: BG, border: 'none', borderRadius: 9, padding: 6, cursor: 'pointer', color: '#94a3b8', ...NEU.raisedXs }} title="ล้างแชทนี้">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div><div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#94a3b8' }}>เลือก Ranger เพื่อเริ่มสนทนา</div>
                                    <div style={{ fontSize: '0.7rem', color: '#c4ccd6' }}>คลิกปุ่ม Ranger ด้านซ้ายค่ะ</div>
                                </div>
                            )}
                            {/* Toggle Panel 3 */}
                            <button onClick={() => setRightPanelOpen(v => !v)} title="Studio"
                                style={{ background: BG, border: 'none', borderRadius: 9, padding: 6, cursor: 'pointer', color: rightPanelOpen ? '#5E9BEB' : '#94a3b8', ...NEU.raisedXs, flexShrink: 0, position: 'relative' }}>
                                <LayoutGrid size={15} />
                                {outputs.length > 0 && !rightPanelOpen && (
                                    <span style={{ position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: '50%', background: '#5E9BEB', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {outputs.length > 9 ? '9+' : outputs.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Banners */}
                        {error && (
                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                                <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />
                                <p style={{ flex: 1, margin: 0, fontSize: '0.76rem', color: '#b91c1c' }}>{error}</p>
                                <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}><X size={13} /></button>
                            </div>
                        )}

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                            <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 38px 10px' }}>
                                {!selectedRanger ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', textAlign: 'center' }}>
                                        <div style={{ width: 60, height: 60, borderRadius: 22, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...NEU.raised }}>
                                            <Sparkles size={26} color="#5E9BEB" />
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#475569', marginBottom: 8 }}>เลือก Ranger เพื่อเริ่มต้น</p>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 260, lineHeight: 1.75 }}>คลิก Ranger ในรายการด้านซ้ายเพื่อเริ่มบทสนทนา</p>
                                    </div>
                                ) : currentMessages.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.8rem' }}>กำลังโหลด...</div>
                                ) : (
                                    <>
                                        {currentMessages.map(msg => {
                                            if (msg.sender === 'system') return (
                                                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: BG, padding: '3px 11px', borderRadius: 99, ...NEU.insetXs }}>{msg.text}</span>
                                                </div>
                                            );
                                            return (
                                                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
                                                    style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', marginBottom: 13 }}>
                                                    <div style={{ display: 'flex', gap: 9, maxWidth: '82%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                                                        {msg.sender === 'agent' && (
                                                            <div style={{ width: 31, height: 31, borderRadius: 9, background: selectedRanger?.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, ...NEU.raisedXs, overflow: 'hidden' }}>
                                                                {msg.isError ? <AlertCircle size={15} color="#f87171" /> :
                                                                    <img src={selectedRanger?.img} alt="" style={{ width: 25, height: 25, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />}
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            borderRadius: 19, padding: '10px 14px',
                                                            ...(msg.isError ? { background: '#FEF2F2', border: '1px solid #FECACA', color: '#b91c1c', borderRadius: '19px 19px 19px 4px' }
                                                                : msg.sender === 'user'
                                                                    ? { background: '#5E9BEB', color: '#fff', borderRadius: '19px 19px 4px 19px', boxShadow: '3px 3px 10px rgba(94,155,235,.3)' }
                                                                    : { background: BG, borderRadius: '19px 19px 19px 4px', ...NEU.raisedSm })
                                                        }}>
                                                            {msg.sender === 'user'
                                                                ? <p style={{ fontSize: '0.83rem', margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                                                                : <MarkdownText text={msg.text} />
                                                            }
                                                            <div style={{ fontSize: '0.63rem', marginTop: 5, display: 'flex', gap: 7, color: msg.sender === 'user' ? 'rgba(255,255,255,.6)' : '#94a3b8', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                                                                <span>{(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                {msg.confidence && msg.confidence < 100 && <span>🎯 {Math.round(msg.confidence <= 1 ? msg.confidence * 100 : msg.confidence)}%</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                        {isLoading && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 13 }}>
                                                <div style={{ display: 'flex', gap: 9 }}>
                                                    <div style={{ width: 31, height: 31, borderRadius: 9, background: selectedRanger?.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', ...NEU.raisedXs, overflow: 'hidden' }}>
                                                        <img src={selectedRanger?.img} alt="" style={{ width: 25, height: 25, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                                                    </div>
                                                    <div style={{ background: BG, borderRadius: '19px 19px 19px 4px', padding: '13px 17px', ...NEU.raisedSm }}>
                                                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 15 }}>
                                                            {[0, 0.18, 0.36].map((d, i) => (
                                                                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E9BEB', animation: `typingdot 0.8s ease-in-out ${d}s infinite` }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* ── Input Bar ── */}
                        <div style={{ flexShrink: 0, padding: '16px 20px 24px', background: BG, borderTop: '1px solid rgba(255,255,255,0.8)' }}>
                            {/* Attachment previews */}
                            {attachments.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 7 }}>
                                    {attachments.map(att => (
                                        <div key={att.name} style={{ position: 'relative' }}>
                                            {att.type.startsWith('image/') ? (
                                                <>
                                                    <img src={previewUrls[att.name]} alt={att.name} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 9, display: 'block' }} />
                                                    <button onClick={() => removeAttachment(att.name)} style={{ position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: '50%', background: '#f87171', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                                </>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: BG, borderRadius: 9, padding: '4px 8px', ...NEU.insetXs }}>
                                                    <FileText size={12} color="#64748b" />
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', maxWidth: 75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                                    <button onClick={() => removeAttachment(att.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}><X size={10} /></button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Outer card for Input */}
                            <div style={{ background: BG, borderRadius: 30, ...NEU.raised, padding: '8px 10px 10px' }}>
                                {/* Top label row */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px 2px' }}>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Input Command</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <button type="button" onClick={() => attachments.length < 5 ? fileInputRef.current?.click() : setError('แนบได้สูงสุด 5 ไฟล์')}
                                            disabled={isLoading}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, border: 'none', background: BG, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', ...NEU.raisedXs, position: 'relative' }}>
                                            <Paperclip size={11} /> Attach
                                            {attachments.length > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: '50%', background: '#5E9BEB', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{attachments.length}</span>}
                                        </button>
                                        {speechSupported && (
                                            <button type="button" onClick={handleSpeechToggle} disabled={isLoading}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
                                                    ...(isListening ? { background: '#10b981', color: '#fff', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' } : { background: BG, color: '#64748b', ...NEU.raisedXs })
                                                }}>
                                                <Mic size={11} /> {isListening ? 'กำลังฟัง…' : 'Voice Mode'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Textarea */}
                                <div style={{ background: BG, borderRadius: 15, ...NEU.inset, margin: '3px 4px 5px' }}>
                                    <textarea ref={textareaRef} value={inputValue}
                                        onChange={e => { setInputValue(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 118) + 'px'; }}
                                        onKeyDown={handleKeyDown} disabled={isLoading || !selectedId} rows={1}
                                        placeholder={isListening ? '🎙 กำลังฟัง...' : selectedRanger ? `บอก${selectedRanger.name}ว่าต้องการอะไร...` : 'เลือก Ranger ก่อนพิมพ์...'}
                                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '9px 13px', fontSize: '0.83rem', color: '#334155', resize: 'none', maxHeight: 118, lineHeight: 1.65, boxSizing: 'border-box', fontFamily: "'Noto Sans Thai','Sarabun',system-ui,sans-serif" }} />
                                </div>

                                {/* Bottom: Mic Start + Create (Symmetric Twin Buttons) */}
                                <div style={{ display: 'flex', gap: 12, padding: '4px 6px 2px' }}>
                                    {speechSupported && (
                                        <button type="button" onClick={handleSpeechToggle}
                                            style={{
                                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 24, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
                                                ...(isListening ? { background: '#10b981', color: '#fff', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.1)' } : { background: BG, color: '#475569', ...NEU.raisedSm })
                                            }}>
                                            <Mic size={14} /> {isListening ? 'กำลังฟัง...' : 'Mic Start'}
                                        </button>
                                    )}
                                    <motion.button onClick={handleSend}
                                        disabled={isLoading || (!inputValue.trim() && attachments.length === 0) || !selectedId}
                                        whileTap={{ scale: 0.96 }}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                                            background: 'linear-gradient(135deg,#5E9BEB 0%,#6C63FF 100%)',
                                            boxShadow: '3px 3px 10px rgba(94,155,235,0.4), -2px -2px 6px rgba(255,255,255,0.8)',
                                            opacity: (isLoading || (!inputValue.trim() && attachments.length === 0) || !selectedId) ? 0.44 : 1
                                        }}>
                                        <Send size={14} /> Create →
                                    </motion.button>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect}
                                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain" />
                        </div>
                    </div>

                    {/* ── PANEL 3: RIGHT (File Work + Brand) ─────────────────────── */}
                    <AnimatePresence>
                        {rightPanelOpen && (
                            <motion.aside
                                initial={{ width: 0, opacity: 0 }} animate={{ width: 308, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(209,217,230,0.6)', background: BG, overflow: 'hidden' }}>

                                {/* Panel 3 Header + tab switcher */}
                                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid rgba(209,217,230,0.5)' }}>
                                    {/* Tabs */}
                                    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                                        {[{ key: 'files', label: '📁 ไฟล์งาน' }, { key: 'brand', label: '⚙ แบรนด์' }].map(tab => (
                                            <button key={tab.key} onClick={() => setP3Tab(tab.key)}
                                                style={{
                                                    padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, transition: 'all 0.2s',
                                                    ...(p3Tab === tab.key ? { background: '#5E9BEB', color: '#fff', boxShadow: '2px 2px 6px rgba(94,155,235,0.3)' } : { background: BG, color: '#64748b', ...NEU.raisedXs })
                                                }}>
                                                {tab.label}
                                                {tab.key === 'files' && outputs.length > 0 && (
                                                    <span style={{ marginLeft: 4, background: p3Tab === 'files' ? 'rgba(255,255,255,0.3)' : '#5E9BEB', color: '#fff', borderRadius: 99, padding: '0 5px', fontSize: 9, fontWeight: 700 }}>{outputs.length}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setRightPanelOpen(false)} style={{ background: BG, border: 'none', borderRadius: 9, padding: 5, cursor: 'pointer', color: '#94a3b8', ...NEU.raisedXs }}>
                                        <X size={13} />
                                    </button>
                                </div>

                                {/* Tab: File Work */}
                                {p3Tab === 'files' && (
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '11px 10px', minHeight: 0 }}>
                                        {outputs.length === 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 22 }}>
                                                <div style={{ width: 50, height: 50, borderRadius: 16, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11, ...NEU.raised }}>
                                                    <FileText size={21} color="#c4ccd6" />
                                                </div>
                                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>ยังไม่มีไฟล์งาน</p>
                                                <p style={{ fontSize: '0.7rem', color: '#c4ccd6', lineHeight: 1.65, margin: 0 }}>เมื่อ Ranger สร้างเอกสาร<br />หรือไฟล์งาน จะแสดงที่นี่</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingLeft: 2 }}>
                                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>ผลงาน</span>
                                                    <button onClick={() => setOutputs([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.66rem', color: '#f87171', fontWeight: 600 }}>ล้างทั้งหมด</button>
                                                </div>
                                                {outputs.map((o, i) => <OutputCard key={o.id || i} output={o} index={i} />)}
                                            </>
                                        )}
                                        {outputs.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 6 }}>
                                                <button onClick={() => {
                                                    const content = outputs.map((o, i) => `=== ${i + 1}. ${o.title || 'ผลลัพธ์'} (by ${o.agentName || 'Ranger'}) ===\n${o.content || o.text || ''}`).join('\n\n---\n\n');
                                                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `AI_Rangers_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.txt`;
                                                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                    URL.revokeObjectURL(url);
                                                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 11, border: 'none', background: BG, cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, color: '#64748b', ...NEU.raisedSm }}>
                                                    <Download size={12} /> ส่งออก
                                                </button>
                                                <button onClick={() => {
                                                    const content = outputs.map((o, i) => `=== ${i + 1}. ${o.title || 'ผลลัพธ์'} ===\n${o.content || o.text || ''}`).join('\n\n---\n\n');
                                                    navigator.clipboard.writeText(content);
                                                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 11, border: 'none', background: BG, cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, color: '#64748b', ...NEU.raisedSm }}>
                                                    <Copy size={12} /> คัดลอก
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Tab: Brand — summary cards + edit via popup */}
                                {p3Tab === 'brand' && (
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '11px 10px', minHeight: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 2 }}>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>YOUR BRAND ({brands.length}/3)</span>
                                        </div>

                                        {/* Brand summary cards */}
                                        {brands.map((b, idx) => {
                                            const industryLabel = INDUSTRY_OPTIONS.find(o => o.value === b.industry)?.label?.replace(/^.{2}\s*/, '') || b.industryOther || '';
                                            return (
                                                <div key={b.id} style={{ background: BG, borderRadius: 16, padding: '12px 13px', marginBottom: 9, ...NEU.raisedSm, border: idx === activeBrandIdx ? '1.5px solid #5E9BEB' : '1.5px solid transparent' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 10, background: b.name ? '#5E9BEB14' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...NEU.raisedXs }}>
                                                            <Building2 size={14} color={b.name ? '#5E9BEB' : '#94a3b8'} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: b.name ? '#334155' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {b.name || 'ยังไม่ได้ระบุชื่อแบรนด์'}
                                                            </div>
                                                            {industryLabel && <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: 1 }}>{industryLabel}</div>}
                                                        </div>
                                                        {idx === activeBrandIdx
                                                            ? <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#10b981', background: '#d1fae5', borderRadius: 99, padding: '2px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>ใช้งานอยู่</span>
                                                            : <button onClick={() => { setActiveBrandIdx(idx); if (b.name) { const ctx = buildContext(b); onContextUpdate?.(ctx); aiService.initialize(ctx); } }}
                                                                style={{ fontSize: '0.62rem', fontWeight: 600, color: '#5E9BEB', background: BG, border: 'none', borderRadius: 99, padding: '2px 9px', cursor: 'pointer', flexShrink: 0, ...NEU.raisedXs, whiteSpace: 'nowrap' }}>เลือกใช้</button>
                                                        }
                                                    </div>
                                                    {b.usp && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '7px 0 0', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.usp}</p>}
                                                </div>
                                            );
                                        })}

                                        {/* Edit button → opens popup */}
                                        <button onClick={() => setShowBrandModal(true)}
                                            style={{ width: '100%', padding: '10px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#5E9BEB 0%,#6C63FF 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#fff', fontSize: '0.78rem', fontWeight: 700, boxShadow: '3px 3px 10px rgba(94,155,235,0.3)', marginTop: 4 }}>
                                            <Building2 size={13} /> แก้ไข / จัดการข้อมูลแบรนด์
                                        </button>
                                    </div>
                                )}
                            </motion.aside>
                        )}
                    </AnimatePresence>

                </div>{/* end panels */}
            </div>

            {/* ── Modals ── */}
            <AnimatePresence>
                {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}
                {showGuidebook && <GuidebookModal onClose={() => setShowGuidebook(false)} />}
                {showBrandModal && (
                    <BrandPopupModal
                        brands={brands}
                        activeBrandIdx={activeBrandIdx}
                        onSave={(newBrands, newActiveIdx) => {
                            setBrands(newBrands);
                            setActiveBrandIdx(newActiveIdx);
                            try { localStorage.setItem('ranger_brands', JSON.stringify(newBrands)); } catch { }
                            if (newBrands[newActiveIdx]?.name) {
                                const ctx = buildContext(newBrands[newActiveIdx]);
                                onContextUpdate?.(ctx);
                                aiService.initialize(ctx);
                            }
                        }}
                        onClose={() => setShowBrandModal(false)} />
                )}
            </AnimatePresence>
        </>
    );
};

export default Workspace;

