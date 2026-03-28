import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{text}</span>
    </div>
  );
}
