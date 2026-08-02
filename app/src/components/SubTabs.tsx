import React from 'react';

interface SubTabsProps {
  currentTab: 'all' | 'short';
  onTabChange: (tab: 'all' | 'short') => void;
}

export const SubTabs: React.FC<SubTabsProps> = ({ currentTab, onTabChange }) => {
  return (
    <div className="sub-tabs-bar">
      <button
        className={`tab-btn ${currentTab === 'all' ? 'active' : ''}`}
        onClick={() => onTabChange('all')}
      >
        Tất cả
      </button>
      <button
        className={`tab-btn ${currentTab === 'short' ? 'active' : ''}`}
        onClick={() => onTabChange('short')}
      >
        Đề rút gọn
      </button>
    </div>
  );
};
