import React from 'react';
import { Home, Utensils, Dumbbell, TrendingUp, BookOpen } from 'lucide-react';

export default function BottomNav({ activeTab = 'home', onSelectTab = () => {} }) {
  const navItems = [
    { id: 'nutrition', label: 'Nutrition', icon: Utensils },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'home', label: 'Home', icon: Home, isCenter: true },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'recipes', label: 'Recipes', icon: BookOpen },
  ];

  return (
    <div className="bottom-nav-wrapper">
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className="nav-center focus:outline-none cursor-pointer"
                aria-label={item.label}
              >
                <Icon size={26} strokeWidth={2.2} />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 focus:outline-none cursor-pointer transition-colors ${
                isActive ? 'text-[#7c3aed] font-semibold' : 'text-[#64748b] hover:text-[#7c3aed]'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
