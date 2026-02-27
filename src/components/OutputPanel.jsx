import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, Download, Sparkles, X } from 'lucide-react';

// ── Neumorphism helpers ───────────────────────────────────────────────────────
const NEU = {
  raised: { boxShadow: '6px 6px 16px #d1d9e6, -6px -6px 16px #ffffff' },
  raisedSm: { boxShadow: '3px 3px 8px #d1d9e6, -3px -3px 8px #ffffff' },
  inset: { boxShadow: 'inset 3px 3px 8px #d1d9e6, inset -3px -3px 8px #ffffff' },
};

// ── Markdown renderer (same as Workspace) ─────────────────────────────────────
const renderInline = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
};

const MarkdownOutput = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('### '))
      elements.push(
        <h3 key={key++} className="font-bold text-gray-800 mt-4 mb-2 text-sm border-b border-gray-100 pb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
    else if (line.startsWith('## '))
      elements.push(
        <h2 key={key++} className="font-bold text-gray-900 mt-5 mb-2 text-base">
          {renderInline(line.slice(3))}
        </h2>
      );
    else if (line.startsWith('# '))
      elements.push(
        <h1 key={key++} className="font-bold text-gray-900 mt-5 mb-3 text-lg">
          {renderInline(line.slice(2))}
        </h1>
      );
    else if (/^[\s]*[-•*]\s/.test(line) || /^\s*\d+\.\s/.test(line))
      elements.push(
        <div key={key++} className="flex gap-2.5 my-1 ml-3">
          <span className="text-blue-400 flex-shrink-0 mt-0.5 font-bold">›</span>
          <span className="text-gray-700 leading-relaxed text-sm">
            {renderInline(line.replace(/^[\s]*[-•*]\s/, '').replace(/^\s*\d+\.\s/, ''))}
          </span>
        </div>
      );
    else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Table row
      const cells = line.trim().split('|').filter(c => c.trim() !== '');
      if (cells.every(c => /^[-:]+$/.test(c.trim()))) {
        // Separator row — skip
      } else {
        elements.push(
          <div key={key++} className="flex gap-0 my-0.5">
            {cells.map((cell, ci) => (
              <div key={ci} className="flex-1 px-2 py-1.5 text-xs border border-gray-100 bg-white first:rounded-l last:rounded-r font-sarabun">
                {renderInline(cell.trim())}
              </div>
            ))}
          </div>
        );
      }
    }
    else if (line.trim() === '---')
      elements.push(<hr key={key++} className="my-4 border-gray-200" />);
    else if (line.trim() === '')
      elements.push(<div key={key++} className="h-2" />);
    else
      elements.push(
        <p key={key++} className="my-1 text-sm text-gray-700 leading-relaxed font-sarabun">
          {renderInline(line)}
        </p>
      );
  }

  return <div className="space-y-0.5">{elements}</div>;
};

// ── Single Output Card ────────────────────────────────────────────────────────
const OutputCard = ({ output, index }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(index === 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(output.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([output.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${output.agentName || 'output'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clusterColors = {
    brand:   '#6C63FF',
    content: '#FF6B9D',
    growth:  '#26de81',
    // Legacy aliases
    strategy: '#6C63FF',
    creative: '#FF6B9D',
  };
  const accent = clusterColors[output.cluster] || '#5E9BEB';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: '#EFF2F9', ...NEU.raised }}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          {output.agentEmoji || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-700 truncate">{output.agentName}</p>
          <p className="text-[10px] text-gray-400 font-sarabun truncate mt-0.5">
            {new Date(output.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            {output.confidence && output.confidence < 1 && ` · 🎯 ${Math.round(output.confidence * 100)}%`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); handleCopy(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
            style={{ background: '#EFF2F9', ...NEU.raisedSm }}
            title="คัดลอก"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleDownload(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
            style={{ background: '#EFF2F9', ...NEU.raisedSm }}
            title="ดาวน์โหลด"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <div className="w-5 flex justify-center text-gray-400">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
      </button>

      {/* Accent bar */}
      <div className="h-0.5 mx-4" style={{ background: `linear-gradient(90deg, ${accent}60, transparent)` }} />

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">
              <div
                className="rounded-xl p-3 max-h-72 overflow-y-auto"
                style={{ background: '#EFF2F9', ...NEU.inset }}
              >
                <MarkdownOutput text={output.text} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main OutputPanel ──────────────────────────────────────────────────────────
export const OutputPanel = ({ outputs, onClose }) => {
  const [filter, setFilter] = useState('all');

  const clusters = [
    { id: 'all',     label: 'ทั้งหมด'      },
    { id: 'brand',   label: 'แบรนด์'       },
    { id: 'content', label: 'คอนเทนต์'     },
    { id: 'growth',  label: 'เติบโต'       },
  ];

  const filtered = filter === 'all' ? outputs : outputs.filter(o => o.cluster === filter);

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="flex flex-col h-full overflow-hidden"
      style={{ width: 320, background: '#EFF2F9', borderLeft: '1px solid rgba(209,217,230,0.6)' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#EFF2F9', ...NEU.raisedSm }}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-700 text-sm">ผลงาน</p>
            <p className="text-[10px] text-gray-400 font-sarabun">{outputs.length} รายการ</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
              style={{ background: '#EFF2F9', ...NEU.raisedSm }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {clusters.map(c => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all font-sarabun"
              style={filter === c.id
                ? { background: '#5E9BEB', color: '#fff' }
                : { background: '#EFF2F9', color: '#94a3b8', ...NEU.raisedSm }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output list */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: '#EFF2F9', ...NEU.raised }}
            >
              <Sparkles className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 font-sarabun">ยังไม่มีผลงาน</p>
            <p className="text-[10px] text-gray-300 font-sarabun mt-1">เริ่มคุยกับ Ranger เพื่อสร้างผลงาน</p>
          </div>
        ) : (
          filtered.map((output, i) => (
            <OutputCard key={output.id} output={output} index={i} />
          ))
        )}
      </div>
    </motion.div>
  );
};

export default OutputPanel;
