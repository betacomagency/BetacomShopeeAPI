import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Search,
  KeyRound,
  Store,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Bell,
} from "lucide-react";
import {
  apiModules,
  apiEndpoints,
  type ApiEndpoint,
} from "@/lib/docs/api-data";
import { pushMechanisms, type PushMechanism } from "@/lib/docs/push-data";

const moduleIcons: Record<string, React.ReactNode> = {
  public: <KeyRound className="h-3.5 w-3.5" />,
  shop: <Store className="h-3.5 w-3.5" />,
  product: <Package className="h-3.5 w-3.5" />,
  order: <ShoppingCart className="h-3.5 w-3.5" />,
  logistics: <Truck className="h-3.5 w-3.5" />,
  payment: <CreditCard className="h-3.5 w-3.5" />,
  push: <Bell className="h-3.5 w-3.5" />,
};

const moduleColors: Record<string, string> = {
  public: "text-brand",
  shop: "text-info",
  product: "text-success",
  order: "text-purple-600",
  logistics: "text-cyan-600",
  payment: "text-pink-600",
  push: "text-indigo-600",
};

function MethodBadgeSmall({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-success/15 text-success border-success/20",
    POST: "bg-info/15 text-info border-info/20",
    PUT: "bg-warning/15 text-warning border-warning/20",
    DELETE: "bg-destructive/15 text-destructive border-destructive/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none border ${colors[method] || "bg-muted text-muted-foreground"}`}>
      {method}
    </span>
  );
}

export function ApiSidebar({
  selectedId,
  onSelect,
  onSelectPush,
}: {
  selectedId: string | null;
  onSelect: (api: ApiEndpoint) => void;
  onSelectPush: (push: PushMechanism) => void;
}) {
  const [search, setSearch] = useState("");
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    Object.fromEntries(apiModules.map((m) => [m.id, true])),
  );

  const filteredEndpoints = apiEndpoints.filter(
    (api) =>
      api.name.toLowerCase().includes(search.toLowerCase()) ||
      api.path.toLowerCase().includes(search.toLowerCase()) ||
      api.description.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredPushes = pushMechanisms.filter(
    (push) =>
      push.name.toLowerCase().includes(search.toLowerCase()) ||
      push.category.toLowerCase().includes(search.toLowerCase()) ||
      push.description.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  return (
    <div className="flex h-full flex-col border-r bg-gradient-to-b from-muted to-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div>
          <h1 className="text-sm font-bold text-red-500">BETACOM WIKI</h1>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm API..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-card px-8 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
          />
        </div>
      </div>

      {/* API List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {apiModules.map((module) => {
            const moduleApis = filteredEndpoints.filter(
              (api) => api.module === module.id,
            );
            const modulePushes = filteredPushes.filter(
              (p) => p.module === module.id,
            );
            if (moduleApis.length === 0 && modulePushes.length === 0)
              return null;

            return (
              <Collapsible
                key={module.id}
                open={openModules[module.id]}
                onOpenChange={() => toggleModule(module.id)}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      {openModules[module.id] ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={moduleColors[module.id]}>
                        {moduleIcons[module.id]}
                      </span>
                      <span>{module.name}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-muted">
                      {moduleApis.length + modulePushes.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-2 space-y-0.5 pb-2">
                    {moduleApis.map((api) => (
                      <button
                        key={api.id}
                        onClick={() => onSelect(api)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                          selectedId === api.id
                            ? "bg-brand/10 text-brand font-medium border border-brand/20 shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}>
                        <MethodBadgeSmall method={api.method} />
                        <span className="truncate">
                          {api.name.split(".").pop()}
                        </span>
                      </button>
                    ))}
                    {modulePushes.map((push) => (
                      <button
                        key={push.id}
                        onClick={() => onSelectPush(push)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                          selectedId === push.id
                            ? "bg-indigo-500/10 text-indigo-600 font-medium border border-indigo-500/20 shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}>
                        <Bell className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{push.name}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 py-3 bg-muted">
        <p className="text-[10px] text-muted-foreground">
          Tổng:{" "}
          <span className="font-semibold text-brand">
            {apiEndpoints.length}
          </span>{" "}
          API ·{" "}
          <span className="font-semibold text-indigo-500">
            {pushMechanisms.length}
          </span>{" "}
          Push
        </p>
      </div>
    </div>
  );
}
