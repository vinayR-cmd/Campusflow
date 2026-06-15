import { Check } from "lucide-react";
import Card from "@/components/ui/Card";

interface ChecklistProps {
  profileComplete: boolean;
  timetableUploaded: boolean;
  gmailConnected: boolean;
  kbDocCount: number;
}

export default function SetupChecklist({
  profileComplete,
  timetableUploaded,
  gmailConnected,
  kbDocCount,
}: ChecklistProps) {
  const items = [
    { label: "Profile complete", done: profileComplete },
    { label: "Upload timetable", done: timetableUploaded },
    { label: "Connect Gmail", done: gmailConnected },
    { label: "Upload campus documents", done: kbDocCount > 0 },
    { label: "Upload ERP screenshot (Phase 2)", done: false },
    { label: "Add WhatsApp messages (Phase 2)", done: false },
  ];

  return (
    <Card className="bg-white border border-slate-100 p-6 shadow-sm rounded-2xl">
      <h2 className="text-sm font-bold text-slate-900">Complete your setup</h2>
      <p className="text-xs text-slate-500 mt-1">Unlock all CampusFlow features by completing these steps</p>
      
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <li 
            key={item.label} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              item.done 
                ? "bg-slate-50/50 border-slate-100 opacity-70" 
                : "bg-white border-slate-200"
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
              item.done 
                ? "bg-emerald-500 text-white" 
                : "border-2 border-slate-200 text-transparent bg-white"
            }`}>
              <Check size={12} strokeWidth={3} className={item.done ? "block" : "hidden"} />
            </div>
            <span className={`text-xs font-semibold ${item.done ? "text-slate-400 line-through font-normal" : "text-slate-700"}`}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
