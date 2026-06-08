"use client";

import type { ConnectionStatus as Status } from "@/lib/qlab/types";

const STATUS_STYLES: Record<Status, { label: string; dot: string }> = {
  connected: { label: "Connected", dot: "bg-green-500" },
  connecting: { label: "Connecting…", dot: "bg-yellow-400" },
  disconnected: { label: "Disconnected", dot: "bg-red-500" },
};

export function ConnectionStatus({ status, message }: { status: Status; message: string | null }) {
  const { label, dot } = STATUS_STYLES[status];

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <span>{label}</span>
      {message && <span className="text-zinc-400 dark:text-zinc-500">— {message}</span>}
    </div>
  );
}
