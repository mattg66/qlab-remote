"use client";

import type { QLabCue } from "@/lib/qlab/types";

/** Maps QLab's named cue colors to Tailwind classes for the button accent. */
const COLOR_CLASSES: Record<string, string> = {
  none: "border-zinc-300 dark:border-zinc-700",
  red: "border-red-500",
  orange: "border-orange-500",
  yellow: "border-yellow-400",
  green: "border-green-500",
  blue: "border-blue-500",
  purple: "border-purple-500",
  pink: "border-pink-500",
  gray: "border-gray-400",
  grey: "border-gray-400",
};

function colorClass(colorName: string): string {
  return COLOR_CLASSES[colorName.toLowerCase()] ?? COLOR_CLASSES.none;
}

export function CueButton({ cue, onTrigger }: { cue: QLabCue; onTrigger: (cueId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onTrigger(cue.uniqueID)}
      className={`flex flex-col items-start gap-1 rounded-lg border-l-4 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 ${colorClass(
        cue.colorName,
      )} ${cue.isRunning ? "ring-2 ring-green-500" : ""}`}
    >
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{cue.number || "—"}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-50">{cue.name || "Untitled cue"}</span>
      {cue.isRunning && (
        <span className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
          Running
        </span>
      )}
    </button>
  );
}
