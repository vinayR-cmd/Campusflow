import { Clock, MapPin, User } from "lucide-react";
import Card from "@/components/ui/Card";

interface Slot {
  id: string;
  time_start: string;
  time_end: string;
  subject: string;
  room: string;
  faculty: string;
}

export default function TodaysClasses({ slots }: { slots: Slot[] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Today's Classes</h2>

      {slots.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No classes scheduled for today.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{slot.subject}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {slot.time_start} - {slot.time_end}
                  </span>
                  {slot.room && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {slot.room}
                    </span>
                  )}
                  {slot.faculty && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {slot.faculty}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
