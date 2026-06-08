"use client";

import { ConnectionStatus } from "@/app/components/ConnectionStatus";
import { CueButton } from "@/app/components/CueButton";
import { useQLabSocket } from "@/app/hooks/useQLabSocket";

export default function Home() {
  const { state, trigger, stop } = useQLabSocket();

  return (
    <div className="flex flex-1 flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-100">QLab Cue Cart Remote</h1>
        <ConnectionStatus status={state.status} message={state.message} />
      </header>

      <main className="flex-1 px-4 py-6">
        {state.status !== "connected" && state.carts.length === 0 ? (
          <p className="text-zinc-500">
            {state.status === "connecting" ? "Connecting to QLab…" : "Waiting for a connection to QLab."}
          </p>
        ) : state.carts.length === 0 ? (
          <p className="text-zinc-500">No Cue Carts found in this workspace.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {state.carts.map((cart) => (
              <section key={cart.uniqueID}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  {cart.name}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {cart.cues.map((cue) => (
                    <CueButton key={cue.uniqueID} cue={cue} onTrigger={trigger} onStop={stop} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
