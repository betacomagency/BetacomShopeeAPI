import { ShopPerformancePanel } from "@/components/panels/ShopPerformancePanel";

export default function ShopPerformancePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hiệu quả bán hàng</h1>
      </div>
      <ShopPerformancePanel />
    </div>
  );
}
