import React, { useState } from 'react';
import { trendingList } from '../data/mockData';

export const Sidebar: React.FC = () => {
  const [numCorrect, setNumCorrect] = useState<string>('');
  const [result, setResult] = useState<string>('-');

  const handleCalculate = () => {
    const val = parseInt(numCorrect);
    if (isNaN(val) || val < 0 || val > 40) {
      setResult('Vui lòng nhập từ 0 - 40!');
      return;
    }

    let chance = '50%';
    if (val >= 39) chance = '99% (Nhà Lĩnh Đạo)';
    else if (val >= 35) chance = '90% (Senior Candidate)';
    else if (val >= 30) chance = '80% (Pass Chắc Chắn)';
    else if (val >= 25) chance = '70% (Tiềm Năng Cao)';
    else if (val >= 20) chance = '50% (Xem Xét)';
    else chance = '30% (Cần Cố Gắng Hơn)';

    setResult(chance);
  };

  return (
    <aside className="sidebar">
      {/* Tarrot Widget */}
      <div className="widget calculator-widget">
        <div className="widget-badge">STUDY LAB</div>
        <h3 className="widget-title">Tarrot</h3>
        <p className="widget-desc">TÍNH KHẢ NĂNG ĐẬU SAU INTERVIEW CHÍNH XÁC 100%</p>
        <div className="calc-box">
          <label htmlFor="calcReading">SỐ CÂU ĐÚNG :</label>
          <input
            type="number"
            id="calcReading"
            min="0"
            max="40"
            value={numCorrect}
            onChange={(e) => setNumCorrect(e.target.value)}
            placeholder="VD: 30"
          />
          <button className="btn-calc" onClick={handleCalculate}>Khả Năng Đậu</button>
          <div className="calc-result">
            Doanh Nghiệp <span>{result}</span>
          </div>
        </div>
      </div>

      {/* Featured Stats Widget */}
      <div className="widget stats-widget">
        <h4 className="widget-subtitle">🔥 Đề thi nổi bật hôm nay</h4>
        <ul className="trending-list">
          {trendingList.map((item) => (
            <li key={item.rank}>
              <span className="rank-num">{item.rank}</span>
              <div className="rank-info">
                <a href="#">{item.title}</a>
                <span>{item.takers}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
