import { PenaltyPanel } from '@/components/panels/PenaltyPanel';

export default function PenaltyPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vi phạm Shop</h1>
        <p className="text-sm text-slate-500 mt-1">
          Theo dõi các vi phạm và điểm phạt từ Shopee
        </p>
      </div>
      <PenaltyPanel />
    </div>
  );
}
