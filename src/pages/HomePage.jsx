import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

/* Floating particle */
const Dot = ({ x, y, size, delay }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: 'rgba(94,155,235,0.18)' }}
    animate={{ y: [0, -12, 0], opacity: [0.1, 0.45, 0.1] }}
    transition={{ duration: 4 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

export const HomePage = ({ onStart }) => {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    id: i, x: 4 + (i * 7.1) % 92, y: 6 + (i * 12.3) % 88, size: 3 + (i % 3) * 2, delay: i * 0.28,
  }));

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#EFF2F9' }}
    >
      {/* Ambient blobs */}
      {dots.map(d => <Dot key={d.id} {...d} />)}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'rgba(94,155,235,0.07)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'rgba(144,97,229,0.06)', filter: 'blur(80px)' }} />

      {/* Hero — centered, max 480px */}
      <div className="relative z-10 text-center px-6 w-full" style={{ maxWidth: 480 }}>
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Logo */}
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-7"
            style={{ background: '#EFF2F9', boxShadow: '8px 8px 20px #d1d9e6, -8px -8px 20px #ffffff' }}
          >
            <Sparkles className="w-9 h-9" style={{ color: '#5E9BEB' }} />
          </motion.div>

          {/* System name */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.55 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight font-en mb-3"
            style={{ color: '#334155' }}
          >
            Agent Ranger
          </motion.h1>

          {/* 6-Layer badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-en mb-3"
            style={{ background: 'rgba(94,155,235,0.1)', color: '#5E9BEB', border: '1px solid rgba(94,155,235,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E9BEB] animate-pulse" />
            6-Layer Data Guard System
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm font-sarabun mb-10 leading-relaxed"
            style={{ color: '#94a3b8' }}
          >
            AI Brand &amp; Marketing Platform · 10 Rangers · ภาษาไทย
          </motion.p>
        </motion.div>

        {/* CTA — single button */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.5 }}
        >
          <motion.button
            onClick={onStart}
            whileHover={{ boxShadow: '8px 8px 24px rgba(94,155,235,0.45), -4px -4px 12px rgba(255,255,255,0.9)' }}
            whileTap={{ scale: 0.96 }}
            className="group inline-flex items-center gap-3 font-semibold text-base relative overflow-hidden"
            style={{
              background: '#5E9BEB',
              borderRadius: 999,
              color: '#fff',
              height: 52,
              paddingLeft: 40,
              paddingRight: 40,
              boxShadow: '4px 4px 14px rgba(94,155,235,0.4), -2px -2px 8px rgba(255,255,255,0.7)',
              fontFamily: 'Inter, sans-serif',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)', width: '50%' }}
            />
            <span className="relative font-sarabun">เริ่มสร้าง</span>
            <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
          </motion.button>

          <p className="text-xs mt-5 font-en tracking-widest" style={{ color: '#cbd5e1' }}>
            PRESS TO CONTINUE
          </p>
        </motion.div>
      </div>

      {/* Footer hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 left-0 right-0 text-center text-xs font-en"
        style={{ color: '#cbd5e1' }}
      >
        © 2025 Agent Ranger × iDEAS365 · Powered by Claude AI
      </motion.p>
    </div>
  );
};

export default HomePage;
