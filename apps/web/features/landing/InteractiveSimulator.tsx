"use client";

import React, { useState } from "react";

export function InteractiveSimulator() {
  // Envelope configuration
  const [maxPerTx, setMaxPerTx] = useState<number>(100);
  const [dailyLimit, setDailyLimit] = useState<number>(500);
  const [spentToday, setSpentToday] = useState<number>(120);
  const [allowlistOnly, setAllowlistOnly] = useState<boolean>(true);
  const [hoursWindow, setHoursWindow] = useState<"business" | "always">("business"); // business: 09:00-18:00

  // Intent to evaluate
  const [intentAmount, setIntentAmount] = useState<number>(75);
  const [simulatedHour, setSimulatedHour] = useState<number>(14); // 14:00 UTC
  const [selectedRecipient, setSelectedRecipient] = useState<string>("openai.mcosm");

  // Allowed recipients
  const approvedRecipients = ["openai.mcosm", "anthropic.mcosm", "aws_cloud.mcosm"];
  const isRecipientAllowed = !allowlistOnly || approvedRecipients.includes(selectedRecipient);

  // Checks
  const checkAsset = true;
  const checkPerTx = intentAmount <= maxPerTx;
  const checkDaily = (spentToday + intentAmount) <= dailyLimit;
  const checkHours = hoursWindow === "always" || (simulatedHour >= 9 && simulatedHour < 18);

  const isApproved = checkAsset && checkPerTx && checkDaily && checkHours && isRecipientAllowed;

  // Calldata simulation
  const recipientHex = "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7".toLowerCase().replace("0x", "").padStart(64, "0");
  const amountBaseUnitsHex = (BigInt(intentAmount) * 1_000_000n).toString(16).padStart(64, "0");
  const calldata = `0xa9059cbb${recipientHex.slice(0, 24)}...${amountBaseUnitsHex.slice(-8)}`;

  return (
    <section id="simulator" className="py-24 px-4 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-3 mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          Interactive Policy Engine
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Simulate an envelope in real-time
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
          Test how Microcosm’s deterministic policy engine approves or rejects autonomous agent intents before any blockchain transaction can be prepared.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Envelope Configuration */}
        <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="font-mono text-sm font-bold text-white">Envelope: env_autonomous_treasury</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              POLICY DEF
            </span>
          </div>

          {/* Max Per Tx Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Max Per Transaction Limit:</span>
              <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                ${maxPerTx}.00 USDC
              </span>
            </div>
            <input
              type="range"
              min={25}
              max={300}
              step={25}
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(Number(e.target.value))}
              className="accent-cyan-400 w-full cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Daily Limit Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Daily Velocity Ceiling:</span>
              <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                ${dailyLimit}.00 USDC
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={1500}
              step={50}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="accent-cyan-400 w-full cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Already Spent Today: ${spentToday}.00</span>
              <span>Available: ${Math.max(0, dailyLimit - spentToday)}.00</span>
            </div>
          </div>

          {/* Operating Hours & Allowlist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Operating Schedule:</label>
              <select
                value={hoursWindow}
                onChange={(e) => setHoursWindow(e.target.value as any)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-200 font-mono outline-none"
              >
                <option value="business">09:00 - 18:00 UTC (Work Hours)</option>
                <option value="always">24/7 (Always Allowed)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Recipient Security:</label>
              <button
                type="button"
                onClick={() => setAllowlistOnly(!allowlistOnly)}
                className={`p-2.5 rounded-lg text-xs font-mono border transition-all text-left flex items-center justify-between ${
                  allowlistOnly
                    ? "bg-cyan-950/40 border-cyan-700 text-cyan-300"
                    : "bg-slate-950 border-slate-700 text-slate-400"
                }`}
              >
                <span>Allowlist Only:</span>
                <span className="font-bold">{allowlistOnly ? "STRICT" : "OPEN"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Test Intent & Live Evaluation */}
        <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">AGENT INTENT TESTER</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              TIME: <span className="text-cyan-400 font-semibold">{simulatedHour.toString().padStart(2, "0")}:00 UTC</span>
            </div>
          </div>

          {/* Intent Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Intent Amount:</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={intentAmount}
                onChange={(e) => setIntentAmount(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Recipient Target:</label>
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-200 outline-none"
              >
                <option value="openai.mcosm">openai.mcosm (Allowlisted)</option>
                <option value="anthropic.mcosm">anthropic.mcosm (Allowlisted)</option>
                <option value="aws_cloud.mcosm">aws_cloud.mcosm (Allowlisted)</option>
                <option value="unknown_wallet.eth">unknown_wallet.eth (Untrusted)</option>
              </select>
            </div>
          </div>

          {/* Time Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Simulated Execution Time:</span>
              <span className="font-mono text-white">{simulatedHour}:00 UTC</span>
            </div>
            <input
              type="range"
              min={0}
              max={23}
              value={simulatedHour}
              onChange={(e) => setSimulatedHour(Number(e.target.value))}
              className="accent-cyan-400 w-full cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Multi-Dimensional Verification Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
            <div className={`p-2 rounded border flex flex-col items-center gap-1 ${checkPerTx ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-300" : "bg-rose-950/30 border-rose-700/50 text-rose-300"}`}>
              <span>PER-TX CAP</span>
              <span className="font-bold">{checkPerTx ? "PASS" : "EXCEEDED"}</span>
            </div>
            <div className={`p-2 rounded border flex flex-col items-center gap-1 ${checkDaily ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-300" : "bg-rose-950/30 border-rose-700/50 text-rose-300"}`}>
              <span>DAILY LIMIT</span>
              <span className="font-bold">{checkDaily ? "PASS" : "EXCEEDED"}</span>
            </div>
            <div className={`p-2 rounded border flex flex-col items-center gap-1 ${checkHours ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-300" : "bg-rose-950/30 border-rose-700/50 text-rose-300"}`}>
              <span>UTC SCHEDULE</span>
              <span className="font-bold">{checkHours ? "PASS" : "BLOCKED"}</span>
            </div>
            <div className={`p-2 rounded border flex flex-col items-center gap-1 ${isRecipientAllowed ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-300" : "bg-rose-950/30 border-rose-700/50 text-rose-300"}`}>
              <span>ALLOWLIST</span>
              <span className="font-bold">{isRecipientAllowed ? "PASS" : "BLOCKED"}</span>
            </div>
          </div>

          {/* Final Engine Verdict */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 font-mono ${
              isApproved
                ? "bg-emerald-950/40 border-emerald-500/50"
                : "bg-rose-950/40 border-rose-500/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${isApproved ? "text-emerald-400" : "text-rose-400"}`}>
                {isApproved ? "VERDICT: APPROVED FOR SETTLEMENT" : "VERDICT: REJECTED BY POLICY SHIELD"}
              </span>
              <span className="text-[10px] text-slate-400">HTTP {isApproved ? "200 OK" : "400 BAD REQUEST"}</span>
            </div>

            {isApproved ? (
              <div className="text-[11px] text-slate-300 flex flex-col gap-1 pt-1">
                <span>Calldata: <code className="text-cyan-300">{calldata}</code></span>
                <span>Destination: <code className="text-slate-400">0x3600...0000 (Arc USDC)</code></span>
              </div>
            ) : (
              <p className="text-[11px] text-rose-300 pt-1">
                Policy engine prevents execution. Zero calldata generated. Zero funds move on Arc.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
