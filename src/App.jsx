import React, { useState, useEffect, Suspense, lazy } from 'react';
import './App.css';

// Pages
const HomePage  = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const Workspace = lazy(() => import('./pages/Workspace').then(m => ({ default: m.Workspace })));
const GuidePage = lazy(() => import('./pages/GuidePage').then(m => ({ default: m.GuidePage })));

// Services
import { orchestratorEngine } from './services/orchestratorEngine';
import { aiService } from './services/aiService';
import { databaseService } from './services/databaseService';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ background: '#EFF2F9' }}>
    <div className="w-12 h-12 border-4 border-[#5E9BEB] border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  // Views: 'home' | 'workspace' | 'guide'
  const [currentView, setCurrentView] = useState('home');
  const [masterContext, setMasterContext] = useState(null);

  // Load brand context: Neon DB first → localStorage fallback
  useEffect(() => {
    const dbStatus = databaseService.getStatus();
    console.log('🗄️  DB Status:', dbStatus);

    const loadContext = async () => {
      // 1. Try Neon DB first (source of truth)
      try {
        const brands = await databaseService.getBrands();
        if (brands && brands.length > 0) {
          const brand = brands[0]; // ใช้ brand แรก (หรือ brand ที่ user เลือก)
          const ctx = {
            brandId: String(brand.id),
            brandNameTh: brand.brandNameTh,
            brandNameEn: brand.brandNameEn,
            industry: brand.industry,
            businessModel: brand.businessModel || 'B2C',
            coreUSP: Array.isArray(brand.coreUsp) ? brand.coreUsp : [brand.coreUsp].filter(Boolean),
            competitors: brand.competitors || [],
            visualStyle: {
              primaryColor: brand.primaryColor || '#5E9BEB',
              secondaryColors: brand.secondaryColors || [],
              moodKeywords: brand.moodKeywords || ['professional'],
              fontFamily: brand.fontFamily,
              videoStyle: brand.videoStyle,
              forbiddenElements: brand.forbiddenElements,
            },
            targetAudience: brand.targetAudience || '',
            targetPersona: brand.targetPersona || '',
            toneOfVoice: brand.toneOfVoice || 'professional',
            painPoints: brand.painPoints || [],
            forbiddenWords: brand.forbiddenWords || [],
            brandHashtags: brand.brandHashtags || [],
            createdAt: brand.createdAt?.toISOString?.() || new Date().toISOString(),
            lastUpdated: brand.updatedAt?.toISOString?.() || new Date().toISOString(),
            isDefault: false,
          };
          setMasterContext(ctx);
          orchestratorEngine.setMasterContext(ctx);
          aiService.initialize(ctx);
          // Sync to localStorage as cache
          localStorage.setItem('socialFactory_masterContext', JSON.stringify(ctx));
          console.log('✅ Context loaded from Neon DB:', ctx.brandNameTh);
          return;
        }
      } catch (err) {
        console.warn('⚠️ Neon DB unavailable, falling back to localStorage:', err.message);
      }

      // 2. Fallback: localStorage cache
      const saved = localStorage.getItem('socialFactory_masterContext');
      if (saved) {
        try {
          const ctx = JSON.parse(saved);
          setMasterContext(ctx);
          orchestratorEngine.setMasterContext(ctx);
          aiService.initialize(ctx);
          console.log('📦 Context loaded from localStorage cache:', ctx.brandNameTh);
        } catch (err) {
          console.error('Failed to parse cached context:', err);
        }
      }
    };

    loadContext();
  }, []);

  // Update context (from Workspace brand popup)
  const handleContextUpdate = (ctx) => {
    setMasterContext(ctx);
    orchestratorEngine.setMasterContext(ctx);
    aiService.initialize(ctx);
  };

  // ── Routing ──────────────────────────────────────────────────────────────────
  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomePage
            onStart={() => setCurrentView('workspace')}
          />
        );

      case 'workspace':
        return (
          <Workspace
            masterContext={masterContext}
            onContextUpdate={handleContextUpdate}
            onOpenGuide={() => setCurrentView('guide')}
          />
        );

      case 'guide':
        return (
          <GuidePage
            onBack={() => setCurrentView('workspace')}
            onStartChat={() => setCurrentView('workspace')}
          />
        );

      default:
        return <HomePage onStart={() => setCurrentView('workspace')} />;
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden" style={{ background: '#EFF2F9' }}>
      <Suspense fallback={<LoadingSpinner />}>
        {renderView()}
      </Suspense>
    </div>
  );
};

export default App;
