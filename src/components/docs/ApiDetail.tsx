import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Globe,
  Send,
  ArrowDownToLine,
  Settings2,
} from "lucide-react"
import type { ApiEndpoint, ApiParam } from "@/lib/docs/api-data"

const methodStyles: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GET: {
    bg: "bg-emerald-500",
    text: "text-emerald-600",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/20",
  },
  POST: {
    bg: "bg-blue-500",
    text: "text-blue-600",
    border: "border-blue-500/30",
    glow: "shadow-blue-500/20",
  },
  PUT: {
    bg: "bg-amber-500",
    text: "text-amber-600",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/20",
  },
  DELETE: {
    bg: "bg-red-500",
    text: "text-red-600",
    border: "border-red-500/30",
    glow: "shadow-red-500/20",
  },
}

function MethodBadge({ method }: { method: string }) {
  const style = methodStyles[method]
  return (
    <span
      className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-bold text-white shadow-md ${style?.bg || "bg-gray-500"} ${style?.glow || ""}`}
    >
      {method}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className={`ml-2 inline-flex items-center rounded-md p-1 transition-all cursor-pointer ${
        copied
          ? "text-emerald-500 bg-emerald-500/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
      title="Sao chép"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function ParamTable({
  params,
  showRequired,
  accentColor = "blue",
}: {
  params: ApiParam[]
  showRequired?: boolean
  accentColor?: string
}) {
  const headerColors: Record<string, string> = {
    blue: "bg-blue-500/5 border-blue-500/10",
    orange: "bg-orange-500/5 border-orange-500/10",
    emerald: "bg-emerald-500/5 border-emerald-500/10",
    purple: "bg-purple-500/5 border-purple-500/10",
  }

  return (
    <table className="w-full text-sm table-fixed">
      <colgroup>
        <col className="w-[25%]" />
        <col className="w-[10%]" />
        {showRequired && <col className="w-[10%]" />}
        <col className="w-[12%]" />
        <col />
      </colgroup>
      <thead>
        <tr className={`border-b ${headerColors[accentColor] || headerColors.blue}`}>
          <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
            Tên
          </th>
          <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
            Kiểu
          </th>
          {showRequired && (
            <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
              Bắt buộc
            </th>
          )}
          <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
            Mẫu
          </th>
          <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
            Mô tả
          </th>
        </tr>
      </thead>
      <tbody>
        {params.map((param, i) => (
          <tr
            key={param.name}
            className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${
              i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
            }`}
          >
            <td className="px-4 py-3">
              <code className="font-mono text-xs font-semibold text-foreground break-all">
                {param.name}
              </code>
            </td>
            <td className="px-4 py-3">
              <Badge
                variant="outline"
                className="font-mono text-xs bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                {param.type}
              </Badge>
            </td>
            {showRequired && (
              <td className="px-4 py-3">
                {param.required ? (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/15 text-[10px]">
                    Bắt buộc
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Tuỳ chọn
                  </span>
                )}
              </td>
            )}
            <td className="px-4 py-3">
              {param.sample ? (
                <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 break-all">
                  {param.sample}
                </code>
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
            </td>
            <td className="px-4 py-3 text-muted-foreground text-sm whitespace-pre-line">
              {param.description}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  color = "blue",
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  color?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  const iconColors: Record<string, string> = {
    blue: "text-blue-500",
    orange: "text-orange-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between py-3 text-left group cursor-pointer">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span className={iconColors[color] || iconColors.blue}>
              {icon}
            </span>
            {title}
          </h3>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function ApiDetail({ api }: { api: ApiEndpoint }) {
  const style = methodStyles[api.method]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="text-orange-500 font-medium">{apiModuleName(api.module)}</span>
          <span>/</span>
          <span>{api.name}</span>
        </div>
        <h1 className="text-2xl font-bold mb-4">{api.name}</h1>
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${style?.border || "border-border"} bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900`}
        >
          <MethodBadge method={api.method} />
          <code className="font-mono text-sm font-medium">{api.path}</code>
          <CopyButton text={api.path} />
        </div>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          {api.description}
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-orange-500/20 via-red-500/20 to-transparent" />

      {/* URL */}
      {api.environments.length > 0 && (
        <CollapsibleSection
          title="URL"
          icon={<Globe className="h-4 w-4" />}
          color="orange"
        >
          <Card className="overflow-hidden border-orange-500/10">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-orange-500/5">
                    <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider w-[120px]">
                      Môi trường
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                      Địa chỉ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {api.environments.map((env) => (
                    <tr key={env.name} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-orange-600">
                        {env.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded break-all">
                            {env.url}
                          </code>
                          <CopyButton text={env.url} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      {/* Common Parameters */}
      {api.commonParams.length > 0 && (
        <CollapsibleSection
          title="Tham số chung"
          icon={<Settings2 className="h-4 w-4" />}
          color="purple"
        >
          <Card className="overflow-hidden border-purple-500/10">
            <CardContent className="p-0">
              <ParamTable params={api.commonParams} accentColor="purple" />
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      {/* Request Parameters */}
      {api.requestParams.length > 0 && (
        <CollapsibleSection
          title="Tham số Request"
          icon={<Send className="h-4 w-4" />}
          color="blue"
        >
          <Card className="overflow-hidden border-blue-500/10">
            <CardContent className="p-0">
              <ParamTable
                params={api.requestParams}
                showRequired
                accentColor="blue"
              />
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      {/* Response Parameters */}
      {api.responseParams.length > 0 && (
        <CollapsibleSection
          title="Tham số Response"
          icon={<ArrowDownToLine className="h-4 w-4" />}
          color="emerald"
        >
          <Card className="overflow-hidden border-emerald-500/10">
            <CardContent className="p-0">
              <ParamTable params={api.responseParams} accentColor="emerald" />
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}
    </div>
  )
}

function apiModuleName(moduleId: string): string {
  const names: Record<string, string> = {
    public: "Xác thực",
    shop: "Shop",
    product: "Sản phẩm",
    order: "Đơn hàng",
    logistics: "Vận chuyển",
    payment: "Thanh toán",
  }
  return names[moduleId] || moduleId
}
