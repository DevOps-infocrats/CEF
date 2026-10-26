import React from 'react';
import { HeroCategory } from '../types';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface HeroTabsProps {
  selectedHero: HeroCategory;
  onSelectHero: (hero: HeroCategory) => void;
}

export const HeroTabs: React.FC<HeroTabsProps> = ({
  selectedHero,
  onSelectHero,
}) => {
  const tabs: Array<{ id: HeroCategory; subtitle: string }> = [
    { id: 'Hero 1', subtitle: 'Category Stream 01' },
    { id: 'Hero 2', subtitle: 'Category Stream 02' },
  ];

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Candidate Application Hero Category"
        className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80"
      >
        {tabs.map((tab) => {
          const isActive = selectedHero === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              id={`tab-${tab.id.replace(/\s+/g, '-').toLowerCase()}`}
              aria-controls={`panel-${tab.id.replace(/\s+/g, '-').toLowerCase()}`}
              tabIndex={0}
              onClick={() => onSelectHero(tab.id)}
              className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'bg-white text-indigo-900 shadow-md shadow-indigo-950/5 border border-indigo-300 ring-1 ring-indigo-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-200/60 text-slate-500'
                }`}
              >
                {tab.id === 'Hero 1' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div className="text-left">
                <span className="block tracking-tight">{tab.id}</span>
                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
