import React, { useState } from 'react';
import { Sparkles, ArrowRight, Zap, TrendingUp, Palette } from 'lucide-react';
import { clusterMetadata } from '../data/agents';

const Hero = ({ onSelectCluster, onStartOnboarding }) => {
  const [hoveredCluster, setHoveredCluster] = useState(null);

  const clusters = [
    {
      id: 'strategy',
      title: 'Strategy Team',
      titleTh: 'ทีมวางแผน',
      emoji: '🧠',
      description: 'วิเคราะห์ธุรกิจและกลยุทธ์',
      descriptionEn: 'Business Analysis & Strategy',
      color: '#FF6B6B',
      icon: 'TrendingUp',
      agents: ['Market Analyst', 'Business Planner', 'Insights Agent'],
      useCases: [
        'วิเคราะห์ SWOT',
        'คำนวณต้นทุนและราคา',
        'ติดตาม KPI'
      ]
    },
    {
      id: 'creative',
      title: 'Creative Team',
      titleTh: 'ทีมสร้างสรรค์',
      emoji: '🎨',
      description: 'ออกแบบและสร้างแบรนด์',
      descriptionEn: 'Brand & Design',
      color: '#FFB6C1',
      icon: 'Palette',
      agents: ['Brand Builder', 'Design Agent', 'Video Generator (Art)'],
      useCases: [
        'ออกแบบโลโก้',
        'สร้าง Brand Identity',
        'วางแผนทีมวิดีโอ'
      ]
    },
    {
      id: 'growth',
      title: 'Growth Team',
      titleTh: 'ทีมขยายธุรกิจ',
      emoji: '🚀',
      description: 'สร้างคอนเทนต์และสื่อสาร',
      descriptionEn: 'Content & Growth',
      color: '#FF1493',
      icon: 'Zap',
      agents: ['Caption Creator', 'Campaign Planner', 'Video Generator (Script)'],
      useCases: [
        'เขียนแคปชั่น',
        'วางแผนแคมเปญ 30 วัน',
        'สร้าง Live Stream'
      ]
    }
  ];

  return (
    <div className="hero-container">
      {/* Header */}
      <div className="hero-header">
        <div className="hero-content">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <img src="/ideas365-logo.png" alt="iDEAS365" style={{ height: '60px' }} />
          </div>

          <h1 className="hero-title">
            <Sparkles size={40} style={{ marginRight: '15px', color: '#FF1493' }} />
            Social Factory AI
          </h1>

          <p className="hero-subtitle">
            ระบบ AI ที่ช่วยคุณบริหารจัดการธุรกิจตามทั้ง 3 ฝ่าย
          </p>

          <p className="hero-description">
            เลือกฝ่ายงานที่คุณต้องการใช้ หรือเริ่ม Onboarding เพื่อให้ระบบเรียนรู้แบรนด์ของคุณ
          </p>
        </div>
      </div>

      {/* Cluster Cards */}
      <div className="clusters-grid">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            className="cluster-card neo-box"
            style={{
              borderColor: cluster.color,
              borderWidth: '2px',
              transform: hoveredCluster === cluster.id ? 'translateY(-8px)' : 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredCluster(cluster.id)}
            onMouseLeave={() => setHoveredCluster(null)}
            onClick={() => onSelectCluster(cluster.id)}
          >
            {/* Card Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>{cluster.emoji}</div>
              <h2 style={{ color: cluster.color, marginBottom: '5px', fontSize: '20px' }}>
                {cluster.title}
              </h2>
              <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>{cluster.titleTh}</p>
            </div>

            {/* Description */}
            <p style={{ fontSize: '14px', marginBottom: '15px', lineHeight: '1.5' }}>
              {cluster.description}
            </p>

            {/* Agents List */}
            <div style={{ marginBottom: '15px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', opacity: 0.7 }}>
                Agents:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                {cluster.agents.map((agent) => (
                  <li key={agent} style={{ marginBottom: '4px' }}>
                    {agent}
                  </li>
                ))}
              </ul>
            </div>

            {/* Use Cases */}
            <div style={{ marginBottom: '15px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', opacity: 0.7 }}>
                Use Cases:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                {cluster.useCases.map((useCase) => (
                  <li key={useCase} style={{ marginBottom: '4px' }}>
                    {useCase}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <button
              className="neo-btn"
              style={{
                background: cluster.color,
                width: '100%',
                marginTop: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'white'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCluster(cluster.id);
              }}
            >
              Explore
              <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Onboarding CTA */}
      <div className="onboarding-section">
        <div className="neo-box" style={{ padding: '30px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '15px' }}>เริ่มต้นใช้งาน</h2>
          <p style={{ marginBottom: '20px', opacity: 0.7 }}>
            ให้ระบบเรียนรู้เกี่ยวกับแบรนด์ของคุณ เพื่อให้ AI ช่วยเหลือได้ดีขึ้น
          </p>
          <button
            className="neo-btn"
            style={{
              background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)',
              color: 'white',
              padding: '12px 30px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={onStartOnboarding}
          >
            <Sparkles size={18} />
            Start Onboarding
          </button>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .hero-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
          animation: fadeIn 0.6s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-header {
          text-align: center;
          margin-bottom: 50px;
        }

        .hero-title {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 15px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -1px;
        }

        .hero-subtitle {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 10px 0;
          color: #333;
        }

        .hero-description {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .clusters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .cluster-card {
          padding: 25px;
          background: white;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .cluster-card:hover {
          box-shadow: var(--shadow-hard-hover);
        }

        .onboarding-section {
          margin-top: 40px;
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 28px;
          }

          .clusters-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Hero;
