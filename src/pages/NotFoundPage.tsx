/**
 * 404 Not Found Page
 */

import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">Không tìm thấy trang</h2>
        <p className="text-muted-foreground mb-6">Trang bạn đang tìm kiếm không tồn tại.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
