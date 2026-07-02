"use client";

import type { QLabCue } from "@/lib/qlab/types";

const BG_COLORS: Record<string, string> = {
  none:   "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600",
  red:    "bg-red-700 hover:bg-red-600 active:bg-red-500",
  orange: "bg-orange-600 hover:bg-orange-500 active:bg-orange-400",
  yellow: "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300",
  green:  "bg-green-700 hover:bg-green-600 active:bg-green-500",
  blue:   "bg-blue-700 hover:bg-blue-600 active:bg-blue-500",
  purple: "bg-purple-700 hover:bg-purple-600 active:bg-purple-500",
  pink:   "bg-pink-600 hover:bg-pink-500 active:bg-pink-400",
  gray:   "bg-zinc-600 hover:bg-zinc-500 active:bg-zinc-400",
  grey:   "bg-zinc-600 hover:bg-zinc-500 active:bg-zinc-400",
};

const TEXT_COLORS: Record<string, string> = {
  none:   "text-zinc-100",
  yellow: "text-yellow-900",
  default: "text-white",
};

function bgClass(colorName: string): string {
  return BG_COLORS[colorName.toLowerCase()] ?? BG_COLORS.none;
}

function textClass(colorName: string): string {
  return TEXT_COLORS[colorName.toLowerCase()] ?? TEXT_COLORS.default;
}

interface CueButtonProps {
  cue: QLabCue;
  onTrigger: (cueId: string) => void;
  onStop: (cueId: string) => void;
}

export function CueButton({ cue, onTrigger, onStop }: CueButtonProps) {
  const displayName = cue.name || cue.listName || "Untitled cue";
  const text = textClass(cue.colorName);

  return (
    <button
      type="button"
      onClick={() => cue.isRunning ? onStop(cue.uniqueID) : onTrigger(cue.uniqueID)}
      className={`flex min-h-48 w-full flex-col justify-between rounded-xl p-5 text-left shadow-md transition-colors ${bgClass(cue.colorName)} ${cue.isRunning ? "ring-4 ring-white/80" : ""}`}
    >
      <span className={`text-sm font-medium opacity-70 ${text}`}>{cue.number || "—"}</span>
      <div className="flex flex-col gap-1">
        <span className={`text-base font-semibold leading-snug ${text}`}>{displayName}</span>
        {cue.isRunning && (
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            Running — tap to stop
          </span>
        )}
      </div>
    </button>
  );
}
