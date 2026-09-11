import React, { useState, useEffect } from 'react';
import { Exam } from '..';
import { fetchExams } from '../api/apicaller';

// Map domain_id to domain name
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
};

interface TarotCard {
  id: number;
  category: 'Cát Tường' | 'Cảnh Báo' | 'Bí Kíp' | 'May Mắn';
  badgeClass: string;
  name: string;
  fortune: string;
  advice: string;
  luckRate: string;
}

const TAROT_CARDS: TarotCard[] = [
  {
    id: 1,
    category: 'May Mắn',
    badgeClass: 'tarot-cat-luck',
    name: 'Thần Rùa Hộ Mệnh',
    fortune: 'Phân vân giữa 2 đáp án? Đáp án nào dài và chi tiết nhất thường là chân lý.',
    advice: 'Mẹo phòng thi: Giữ nguyên lựa chọn đầu tiên trừ khi phát hiện bằng chứng sai rõ ràng.',
    luckRate: '95%',
  },
  {
    id: 2,
    category: 'Cát Tường',
    badgeClass: 'tarot-cat-blessing',
    name: 'Trí Tuệ Khai Thông',
    fortune: 'Não bộ hôm nay load cực nhanh, đọc đề thi đến đâu nhớ ngay công thức đến đó.',
    advice: 'Mẹo phòng thi: Tranh thủ làm thử một bài kiểm tra ngắn ngay để duy trì nhịp tư duy.',
    luckRate: '99%',
  },
  {
    id: 3,
    category: 'Cảnh Báo',
    badgeClass: 'tarot-cat-warning',
    name: 'Cạm Bẫy Trắc Nghiệm',
    fortune: 'Đề thi có thể gài bẫy ở các từ "KHÔNG PHẢI", "NGOẠI TRỪ" hoặc "TẤT CẢ ĐỀU ĐÚNG".',
    advice: 'Mẹo phòng thi: Đọc kỹ từ khóa phủ định trong câu hỏi trước khi chọn phương án.',
    luckRate: '75%',
  },
  {
    id: 4,
    category: 'Bí Kíp',
    badgeClass: 'tarot-cat-tip',
    name: 'Chân Ái Khoanh C',
    fortune: 'Thời gian chỉ còn 30 giây mà còn câu chưa kịp làm? Khoanh thẳng một hàng C là an toàn nhất.',
    advice: 'Mẹo phòng thi: Tuyệt đối không đánh zíc-zắc ngẫu nhiên, xác suất trúng sẽ thấp hơn.',
    luckRate: '82%',
  },
  {
    id: 5,
    category: 'Cát Tường',
    badgeClass: 'tarot-cat-blessing',
    name: 'Chiến Binh Cú Đêm',
    fortune: 'Càng về đêm năng lượng tư duy càng sáng tỏ, tinh thần thép không ngại đề hóc búa.',
    advice: 'Mẹo phòng thi: Uống một ngụm nước và hít thở sâu 3 nhịp trước khi bấm nộp bài.',
    luckRate: '88%',
  },
  {
    id: 6,
    category: 'May Mắn',
    badgeClass: 'tarot-cat-luck',
    name: 'Bút Chì 2B Thần Thánh',
    fortune: 'Vận may thi cử mỉm cười. Mọi câu trả lời bạn nghi ngờ đều có khả năng cao là đúng.',
    advice: 'Mẹo phòng thi: Kiểm tra kỹ số lượng câu đã chọn trong bảng điều hướng trước khi nộp.',
    luckRate: '92%',
  },
  {
    id: 7,
    category: 'Bí Kíp',
    badgeClass: 'tarot-cat-tip',
    name: 'Phượng Hoàng Nước Rút',
    fortune: 'Áp lực tạo nên kim cương. Càng gần hết giờ, khả năng tập trung càng đạt đỉnh điểm.',
    advice: 'Mẹo phòng thi: Quét sạch các câu dễ trong 5 phút đầu tiên để cầm chắc điểm sàn.',
    luckRate: '86%',
  },
  {
    id: 8,
    category: 'Cảnh Báo',
    badgeClass: 'tarot-cat-warning',
    name: 'Ảo Giác Tự Tin',
    fortune: 'Đề bài nhìn tưởng chừng rất quen thuộc nhưng có thể chứa điều kiện ẩn về đơn vị đo.',
    advice: 'Mẹo phòng thi: Kiểm tra kỹ câu hỏi hỏi về "đúng" hay "sai" trước khi chốt đáp án.',
    luckRate: '70%',
  },
];

export const Sidebar: React.FC = () => {
  const [currentCard, setCurrentCard] = useState<TarotCard | null>(null);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [featuredExams, setFeaturedExams] = useState<Exam[]>([]);

  useEffect(() => {
    fetchExams()
      .then((data: Exam[]) => {
        setFeaturedExams(data.slice(0, 3));
      })
      .catch(() => {
        setFeaturedExams([]);
      });
  }, []);

  const handleDrawCard = () => {
    setIsDrawing(true);
    setTimeout(() => {
      let nextIndex = Math.floor(Math.random() * TAROT_CARDS.length);
      if (currentCard && nextIndex === currentCard.id - 1) {
        nextIndex = (nextIndex + 1) % TAROT_CARDS.length;
      }
      setCurrentCard(TAROT_CARDS[nextIndex]);
      setHasDrawn(true);
      setIsDrawing(false);
    }, 350);
  };

  return (
    <aside className="sidebar">
      {/* Tarot Exam Fortune Widget */}
      <div className="widget calculator-widget">
        <div className="widget-badge">QUẺ BÓI MÙA THI</div>
        <h3 className="widget-title">Tarot Tri Thức</h3>
        <p className="widget-desc">Gieo một quẻ xem hôm nay thần học hành mách bảo điều gì</p>
        
        <div className="tarot-card-box">
          {!hasDrawn || !currentCard ? (
            <div className="tarot-card-cover">
              <div className="tarot-cover-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <h4 className="tarot-cover-title">Thẻ Bài Tri Thức Đang Úp</h4>
              <p className="tarot-cover-desc">Nhấn nút bên dưới để gieo quẻ và xem lời sấm thi cử của bạn hôm nay.</p>
            </div>
          ) : (
            <div className={`tarot-card-display ${isDrawing ? 'is-drawing' : ''}`}>
              <span className={`tarot-category-badge ${currentCard.badgeClass}`}>
                {currentCard.category}
              </span>
              <h4 className="tarot-card-title">{currentCard.name}</h4>
              <p className="tarot-fortune-text">"{currentCard.fortune}"</p>
              <div className="tarot-advice-box">
                <strong>Bí kíp:</strong> {currentCard.advice}
              </div>
              <div className="tarot-luck-meter">
                <span>Độ hợp đề hôm nay</span>
                <strong>{currentCard.luckRate}</strong>
              </div>
            </div>
          )}

          <button 
            className="btn-draw-tarot" 
            onClick={handleDrawCard}
            disabled={isDrawing}
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="14" height="16" rx="2" />
              <path d="M6 8h6" />
              <path d="M6 12h6" />
              <path d="M6 16h4" />
              <path d="M18 8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8" />
            </svg>
            {isDrawing 
              ? 'Đang bốc quẻ...' 
              : !hasDrawn 
                ? 'Rút Quẻ Ngay' 
                : 'Rút Quẻ Khác'}
          </button>
        </div>
      </div>

      {/* Featured Stats Widget */}
      <div className="widget stats-widget">
        <h4 className="widget-subtitle">Đề thi nổi bật hôm nay</h4>
        <ul className="trending-list">
          {featuredExams.map((exam, index) => (
            <li key={exam.id}>
              <span className="rank-num">{index + 1}</span>
              <div className="rank-info">
                <a href="#">{exam.name}</a>
                <span>{DOMAIN_MAP[exam.domain_id] || 'Khác'}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
