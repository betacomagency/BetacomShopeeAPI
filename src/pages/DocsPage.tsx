import { useState, useEffect, useCallback } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { ApiSidebar } from "@/components/docs/ApiSidebar"
import { ApiDetail } from "@/components/docs/ApiDetail"
import { PushDetail } from "@/components/docs/PushDetail"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiEndpoints, apiModules, type ApiEndpoint } from "@/lib/docs/api-data"
import { pushMechanisms, type PushMechanism } from "@/lib/docs/push-data"
import { useAuth } from "@/hooks/useAuth"
import {
  KeyRound,
  Store,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Bell,
  Zap,
  Activity,
} from "lucide-react"

const moduleIconMap: Record<string, React.ReactNode> = {
  public: <KeyRound className="h-5 w-5" />,
  shop: <Store className="h-5 w-5" />,
  account_health: <Activity className="h-5 w-5" />,
  product: <Package className="h-5 w-5" />,
  order: <ShoppingCart className="h-5 w-5" />,
  logistics: <Truck className="h-5 w-5" />,
  payment: <CreditCard className="h-5 w-5" />,
  flash_sale: <Zap className="h-5 w-5" />,
  push: <Bell className="h-5 w-5" />,
}

const moduleColorMap: Record<string, string> = {
  public: "from-orange-500 to-amber-500",
  shop: "from-blue-500 to-cyan-500",
  account_health: "from-yellow-500 to-orange-500",
  product: "from-emerald-500 to-green-500",
  order: "from-purple-500 to-violet-500",
  logistics: "from-cyan-500 to-teal-500",
  payment: "from-pink-500 to-rose-500",
  flash_sale: "from-red-500 to-orange-500",
  push: "from-indigo-500 to-violet-500",
}

function WelcomePage() {
  const modulesWithApis = apiModules.filter(
    (m) => apiEndpoints.some((a) => a.module === m.id) || pushMechanisms.some((p) => p.module === m.id)
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-8">
      <div className="max-w-xl w-full space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-500">
              BETACOM
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Wiki API Shopee Open Platform v2
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{modulesWithApis.length}</p>
            <p className="text-xs text-muted-foreground">Module</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{apiEndpoints.length}</p>
            <p className="text-xs text-muted-foreground">Endpoint</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{pushMechanisms.length}</p>
            <p className="text-xs text-muted-foreground">Push</p>
          </div>
        </div>

        {/* Module list */}
        {modulesWithApis.length > 0 && (
          <div>
            <h2 className="text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wider">
              Module hiện có
            </h2>
            <div className="space-y-2">
              {modulesWithApis.map((module) => {
                const count = apiEndpoints.filter(
                  (a) => a.module === module.id
                ).length
                const pushCount = pushMechanisms.filter((p) => p.module === module.id).length
                return (
                  <div
                    key={module.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${moduleColorMap[module.id]} text-white`}
                      >
                        {moduleIconMap[module.id]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{module.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {module.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {count > 0 && `${count} API`}{count > 0 && pushCount > 0 && " · "}{pushCount > 0 && `${pushCount} Push`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Chọn một API từ sidebar bên trái để xem chi tiết.
        </p>
      </div>
    </div>
  )
}

type SelectedItem =
  | { type: "api"; item: ApiEndpoint }
  | { type: "push"; item: PushMechanism }
  | null

export default function DocsPage() {
  const { isAuthenticated, isLoading, session } = useAuth()
  const [selected, setSelected] = useState<SelectedItem>(null)
  const [mounted, setMounted] = useState(false)

  const handleSelect = useCallback((api: ApiEndpoint) => {
    setSelected({ type: "api", item: api })
    window.history.replaceState(null, "", `#${api.id}`)
  }, [])

  const handleSelectPush = useCallback((push: PushMechanism) => {
    setSelected({ type: "push", item: push })
    window.history.replaceState(null, "", `#${push.id}`)
  }, [])

  const findItem = (hash: string): SelectedItem => {
    const api = apiEndpoints.find((a) => a.id === hash)
    if (api) return { type: "api", item: api }
    const push = pushMechanisms.find((p) => p.id === hash)
    if (push) return { type: "push", item: push }
    return null
  }

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      setSelected(findItem(hash))
    }
    setMounted(true)

    const onHashChange = () => {
      const h = window.location.hash.slice(1)
      if (h) {
        setSelected(findItem(h))
      } else {
        setSelected(null)
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0">
        <ApiSidebar
          selectedId={selected?.item.id ?? null}
          onSelect={handleSelect}
          onSelectPush={handleSelectPush}
        />
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-4xl mx-auto p-8">
          {!mounted ? null : selected?.type === "api" ? (
            <ApiDetail api={selected.item} />
          ) : selected?.type === "push" ? (
            <PushDetail push={selected.item} />
          ) : (
            <WelcomePage />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
