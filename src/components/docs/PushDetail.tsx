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
  Info,
  Send,
  FileJson,
} from "lucide-react"
import type { PushMechanism, PushParam } from "@/lib/docs/push-data"

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
    blue: "text-info",
    indigo: "text-indigo-600",
    emerald: "text-success",
    cyan: "text-cyan-600",
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

function PushParamRows({
  params,
  depth = 0,
}: {
  params: PushParam[]
  depth?: number
}) {
  return (
    <>
      {params.map((param, i) => (
        <PushParamRow key={`${depth}-${param.name}-${i}`} param={param} depth={depth} index={i} />
      ))}
    </>
  )
}

function PushParamRow({
  param,
  depth,
  index,
}: {
  param: PushParam
  depth: number
  index: number
}) {
  return (
    <>
      <tr
        className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${
          index % 2 === 0 ? "bg-transparent" : "bg-muted/20"
        }`}
      >
        <td className="px-4 py-3">
          <code className="font-mono text-sm font-semibold text-foreground">
            {depth > 0 && (
              <span
                className="text-muted-foreground"
                style={{ paddingLeft: `${(depth - 1) * 16}px` }}
              >
                {"└─ "}
              </span>
            )}
            {param.name}
          </code>
          {param.required === false && (
            <Badge
              variant="outline"
              className="ml-2 text-[10px] bg-warning/10 text-warning border-warning/20"
            >
              Tuỳ chọn
            </Badge>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge
            variant="outline"
            className="font-mono text-xs bg-muted border-border"
          >
            {param.type}
          </Badge>
        </td>
        <td className="px-4 py-3">
          {param.sample ? (
            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
              {param.sample}
            </code>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground text-sm max-w-[400px] whitespace-pre-line">
          {param.description}
        </td>
      </tr>
      {param.children && param.children.length > 0 && (
        <PushParamRows params={param.children} depth={depth + 1} />
      )}
    </>
  )
}

export function PushDetail({ push }: { push: PushMechanism }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="text-indigo-500 font-medium">{push.category}</span>
          <span>/</span>
          <span>{push.name}</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">{push.name}</h1>
      </div>

      <div className="h-px bg-gradient-to-r from-indigo-500/20 via-blue-500/20 to-transparent" />

      {/* Basics Section */}
      <CollapsibleSection
        title="Thông tin cơ bản"
        icon={<Info className="h-4 w-4" />}
        color="indigo"
      >
        <Card className="overflow-hidden border-indigo-500/10">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-indigo-500/5 border-indigo-500/10">
                    <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider w-[220px]">
                      Thuộc tính
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                      Giá trị
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Danh mục", value: push.category },
                    { label: "Tên cơ chế Push", value: push.name },
                    { label: "Mã cơ chế Push", value: String(push.code) },
                    { label: "Mô tả", value: push.description },
                    { label: "Quy tắc đăng ký", value: push.subscriptionRules },
                    { label: "Thời gian chờ (giây)", value: push.timeoutSeconds },
                    {
                      label: "Đảm bảo thứ tự",
                      value: push.sequenceGuaranteed ? "Có" : "Không",
                    },
                    {
                      label: "Có thể gửi lại tin nhắn trùng",
                      value: push.canRepeatedSameMessage ? "Có" : "Không",
                    },
                    { label: "Thời gian thử lại (giây)", value: push.retrySeconds },
                  ].map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400">
                        {row.label}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Push Parameters Section */}
      {push.pushParams.length > 0 && (
        <CollapsibleSection
          title="Tham số Push"
          icon={<Send className="h-4 w-4" />}
          color="blue"
        >
          <Card className="overflow-hidden border-blue-500/10">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-blue-500/5 border-blue-500/10">
                      <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                        Tên
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                        Kiểu
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                        Mẫu
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground/70 text-xs uppercase tracking-wider">
                        Mô tả
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <PushParamRows params={push.pushParams} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      {/* Push Contents Section */}
      {push.pushContents.length > 0 && (
        <CollapsibleSection
          title="Nội dung Push"
          icon={<FileJson className="h-4 w-4" />}
          color="emerald"
        >
          <div className="space-y-4">
            {push.pushContents.map((content, i) => (
              <Card key={i} className="overflow-hidden border-emerald-500/10">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-500/10 bg-emerald-500/5">
                    <span className="text-sm font-medium">{content.title}</span>
                    <div className="flex items-center gap-1">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15 text-[10px]">
                        Json
                      </Badge>
                      <CopyButton text={content.json} />
                    </div>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-muted-foreground bg-muted">
                    {formatJson(content.json)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

function formatJson(jsonString: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2)
  } catch {
    return jsonString
  }
}
