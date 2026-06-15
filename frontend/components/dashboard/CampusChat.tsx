"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import { Send, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

export interface CampusChatHandle {
  ask: (question: string) => void;
}

interface StudentContext {
  college: string;
  branch: string;
  year: number;
  section: string;
  hostel: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
}

const CampusChat = forwardRef<CampusChatHandle, { studentContext: StudentContext }>(
  ({ studentContext }, ref) => {
    const [messages, setMessages] = useState<Message[]>([
      {
        role: "assistant",
        text: "Hi! Ask me anything about your college — syllabus, hostel rules, exam schedules, placement notices, and more.",
      },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const ask = async (question: string) => {
      setMessages((prev) => [...prev, { role: "user", text: question }]);
      setLoading(true);

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await api.post("/api/kb/query", {
          question,
          student_context: {
            college: studentContext.college,
            branch: studentContext.branch,
            year: studentContext.year ? String(studentContext.year) : null,
            section: studentContext.section,
            hostel: studentContext.hostel,
          },
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: res.data.answer, sources: res.data.sources },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Something went wrong reaching the campus assistant. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    useImperativeHandle(ref, () => ({ ask }));

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
      if (!input.trim() || loading) return;
      ask(input.trim());
      setInput("");
    };

    return (
      <Card>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-slate-900">Campus Q&A</h2>
        </div>

        <div className="mt-4 flex h-80 flex-col gap-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "self-end bg-primary text-white"
                  : "self-start bg-white text-slate-700 border border-slate-100"
              }`}
            >
              <p>{msg.text}</p>
              {msg.sources && msg.sources.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Source: {msg.sources.join(", ")}
                </p>
              )}
            </div>
          ))}
          {loading && (
            <div className="self-start rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-400">
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your question..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button onClick={handleSend} disabled={loading}>
            <Send size={16} />
          </Button>
        </div>
      </Card>
    );
  }
);

CampusChat.displayName = "CampusChat";

export default CampusChat;
