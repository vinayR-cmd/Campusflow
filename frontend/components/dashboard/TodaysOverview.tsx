"use client";

import { useState } from "react";
import { Sparkles, Bus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function TodaysOverview({
  classesCount,
  deadlinesCount,
  ahsScore,
  pendingTasksCount,
  onAsk,
  nextBusDeparture,
}: {
  classesCount: number;
  deadlinesCount: number;
  ahsScore: number;
  pendingTasksCount: number;
  onAsk: (question: string) => void;
  nextBusDeparture?: string | null;
}) {
  const [question, setQuestion] = useState("");

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleAsk = () => {
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-400">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Today's Overview</h1>
          {nextBusDeparture && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 w-fit">
              <Bus size={12} />
              <span>{nextBusDeparture}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6 text-center">
          <Stat label="Classes Today" value={classesCount} />
          <Stat label="Deadlines (48h)" value={deadlinesCount} />
          <Stat label="AHS Score" value={ahsScore} />
          <Stat label="Pending Tasks" value={pendingTasksCount} />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Sparkles
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary"
          />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask Campus AI anything..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <Button onClick={handleAsk}>Ask</Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
