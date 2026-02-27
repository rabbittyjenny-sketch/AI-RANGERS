import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, MessageSquare, ChevronDown } from 'lucide-react';
import { getAllAgents } from '../data/agents';

const CLUSTER_CFG = {
  strategy: { label:'Strategy', labelTh:'วางกลยุทธ์', color:'#FF6B6B' },
  creative:  { label:'Creative', labelTh:'สร้างสรรค์', color:'#A78BFA' },
  growth:    { label:'Growth',   labelTh:'ขับเคลื่อน', color:'#34D399' },
};

const AgentCard = ({ agent, index, onSelect }) => {
  const [open, setOpen] = useState(false);
  const cfg = CLUSTER_CFG[agent.cluster] || { color:'#5E9BEB', label:'Agent' };

  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:0.04*index, duration:0.4 }}
                className="rounded-2xl border border-white/[0.07] overflow-hidden"
                style={{ background:'rgba(255,255,255,0.025)' }}>

      {/* Header */}
      <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
              onClick={() => setOpen(v=>!v)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
               style={{ background:cfg.color+'20' }}>
            {agent.emoji || '🤖'}
          </div>
          <span className="font-bold text-white text-sm truncate">{agent.name}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 ml-2 transition-transform duration-200 ${open?'rotate-180':''}`}/>
      </button>

      {/* Collapsed hint */}
      {!open && (
        <div className="px-5 pb-4 border-t border-white/[0.04]">
          <p className="text-white/35 text-xs leading-relaxed line-clamp-2 mt-2">{agent.description}</p>
          <p className="text-white/20 text-xs mt-3 text-center tracking-wide">Click for details</p>
        </div>
      )}

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-5 border-t border-white/[0.06]">
          <p className="text-white/45 text-sm leading-relaxed mt-4 mb-4">{agent.description}</p>

          {/* Meta */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/25">Cluster:</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono"
                    style={{ background:cfg.color+'18', color:cfg.color }}>
                {cfg.label}
              </span>
            </div>
            {agent.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {agent.keywords.slice(0,5).map(k=>(
                  <span key={k} className="text-xs bg-white/5 border border-white/[0.07] px-2 py-0.5 rounded-full text-white/35">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <button onClick={() => onSelect(agent.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background:cfg.color+'18', color:cfg.color, border:`1px solid ${cfg.color}30` }}>
            <MessageSquare className="w-4 h-4"/>
            Chat with Agent
          </button>
        </div>
      )}
    </motion.div>
  );
};

export const Dashboard = ({ clusterId, onBack, onSelectAgent, masterContext }) => {
  const [search, setSearch] = useState('');
  const [activeCluster, setActiveCluster] = useState(clusterId || 'all');
  const allAgents = getAllAgents();

  const filtered = allAgents.filter(a => {
    const mc = activeCluster === 'all' || a.cluster === activeCluster;
    const q = search.toLowerCase();
    const ms = !q || a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.keywords||[]).some(k=>k.toLowerCase().includes(q));
    return mc && ms;
  });

  const tabs = ['all','strategy','creative','growth'];

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#5E9BEB]/4 rounded-full blur-[120px]"/>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Top nav */}
        <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                    className="flex items-center gap-4 mb-8 border-b border-white/[0.06] pb-5">
          <button onClick={onBack}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4"/> Back
          </button>
          <div className="h-4 w-px bg-white/10"/>
          <span className="font-bold text-white text-sm">Agents</span>
          {masterContext?.brandNameTh && (
            <div className="ml-auto flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse"/>
              <span className="text-[#34D399] font-medium">{masterContext.brandNameTh}</span>
            </div>
          )}
        </motion.div>

        {/* Title + search */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:0.1 }}
                    className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Discovered Agents</h2>
            <p className="text-white/30 text-xs mt-1">{filtered.length} agents พร้อมใช้งาน</p>
          </div>
          <div className="bg-white/5 border border-white/[0.07] rounded-xl px-4 py-2.5 flex items-center gap-2 w-full sm:w-52">
            <Search className="w-4 h-4 text-white/25 flex-shrink-0"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
                   placeholder="Search agents..."
                   className="bg-transparent text-sm text-white placeholder-white/25 outline-none w-full"/>
          </div>
        </motion.div>

        {/* Cluster tabs */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
                    className="flex items-center gap-2 mb-7 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(t => {
            const cfg = CLUSTER_CFG[t];
            const active = activeCluster === t;
            return (
              <button key={t} onClick={()=>setActiveCluster(t)}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                      style={active
                        ? { background:cfg?cfg.color+'20':'rgba(94,155,235,0.18)',
                            color:cfg?cfg.color:'#5E9BEB',
                            border:`1px solid ${cfg?cfg.color+'35':'rgba(94,155,235,0.35)'}` }
                        : { background:'rgba(255,255,255,0.04)',
                            color:'rgba(255,255,255,0.35)',
                            border:'1px solid rgba(255,255,255,0.06)' }}>
                {t==='all' ? '✦ All' : cfg.labelTh}
              </button>
            );
          })}
        </motion.div>

        {/* Grid */}
        {filtered.length > 0
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a,i)=>(
                <AgentCard key={a.id} agent={a} index={i} onSelect={onSelectAgent}/>
              ))}
            </div>
          : <div className="text-center py-20 text-white/25">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">ไม่พบ Agent "{search}"</p>
            </div>
        }
      </div>
    </div>
  );
};

export default Dashboard;
