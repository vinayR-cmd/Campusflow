"use client";

import { useState, useRef, useEffect } from "react";
import { CheckCircle2, Circle, Mail, MessageCircle, FileText, Bus, Send, Upload, ChevronDown, ChevronUp } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { showPointsToast } from "@/lib/toast";

interface TransportRoute {
  id: string;
  route: string;
  stops: string[];
  departure_times: string[];
}

export default function DataSources({
  gmailConnected,
  kbDocCount,
  onUploadDoc,
  whatsappNumber,
  onWhatsappSaved,
  onTasksUpdated,
  selectedRoute,
  onRouteSelected,
}: {
  gmailConnected: boolean;
  kbDocCount: number;
  onUploadDoc: () => void;
  whatsappNumber?: string | null;
  onWhatsappSaved: (num: string) => void;
  onTasksUpdated: () => void;
  selectedRoute?: string | null;
  onRouteSelected: (route: string) => void;
}) {
  const [connectingGmail, setConnectingGmail] = useState(false);
  
  // Section toggle states
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [showTransport, setShowTransport] = useState(false);

  // WhatsApp states
  const whatsappFileRef = useRef<HTMLInputElement>(null);
  const [uploadingWhatsapp, setUploadingWhatsapp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState(whatsappNumber || "");
  const [savingPhone, setSavingPhone] = useState(false);

  // Transport states
  const transportFileRef = useRef<HTMLInputElement>(null);
  const [uploadingTransport, setUploadingTransport] = useState(false);
  const [transportStatus, setTransportStatus] = useState<string | null>(null);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const twilioNumber = process.env.NEXT_PUBLIC_TWILIO_SANDBOX_NUMBER || "+14155238886";

  // Load transport routes on mount
  useEffect(() => {
    fetchRoutes();
  }, []);

  // Award Gmail points if connected
  useEffect(() => {
    if (gmailConnected) {
      const awardGmailPoints = async () => {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await api.post("/api/leaderboard/award-points", { action: "gmail_connected" }, { headers });
          if (res.data?.success) {
            showPointsToast(3, "+3 points for connecting Gmail! 🏆");
          }
        } catch (err) {
          console.error("Failed to award gmail points:", err);
        }
      };
      awardGmailPoints();
    }
  }, [gmailConnected]);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.get("/api/gmail/auth-url", { headers });
      window.location.href = res.data.url;
    } catch {
      setConnectingGmail(false);
    }
  };

  // WhatsApp Export Upload
  const handleWhatsappFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingWhatsapp(true);
    setWhatsappStatus(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.post("/api/whatsapp/upload-export", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          ...authHeaders
        },
      });
      if (res.data && res.data.message) {
        setWhatsappStatus(res.data.message);
      } else {
        const count = res.data.tasks_created || 0;
        if (count > 0) {
          setWhatsappStatus(`${count} tasks extracted from your WhatsApp messages.`);
        } else {
          setWhatsappStatus("No academic tasks found in this chat. Try a group with assignment/deadline messages.");
        }
      }
      onTasksUpdated();
    } catch {
      setWhatsappStatus("Failed to extract tasks. Please ensure the file is a valid export .txt file.");
    } finally {
      setUploadingWhatsapp(false);
      if (whatsappFileRef.current) whatsappFileRef.current.value = "";
    }
  };

  // Save WhatsApp number
  const handleSavePhone = async () => {
    const cleanedNum = phoneInput.replace(/\s/g, '').trim();
    if (!cleanedNum.startsWith("+") || cleanedNum.length < 10) {
      alert("Please enter a valid country-code prefixed number, e.g. +91XXXXXXXXXX");
      return;
    }

    setSavingPhone(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/whatsapp/register-number", { whatsapp_number: cleanedNum }, { headers });
      onWhatsappSaved(cleanedNum);
      alert("WhatsApp number registered successfully!");

      try {
        const res = await api.post("/api/leaderboard/award-points", { action: "whatsapp_connected" }, { headers });
        if (res.data?.success) {
          showPointsToast(3, "+3 points for connecting WhatsApp! 🏆");
        }
      } catch (err) {
        console.error("Failed to award whatsapp points:", err);
      }
    } catch {
      alert("Failed to save WhatsApp number.");
    } finally {
      setSavingPhone(false);
    }
  };

  // Transport Routes upload
  const handleTransportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingTransport(true);
    setTransportStatus(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/transport/upload", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          ...authHeaders
        },
      });
      setTransportStatus("Bus schedule uploaded successfully!");
      fetchRoutes();
    } catch {
      setTransportStatus("Failed to upload bus schedule.");
    } finally {
      setUploadingTransport(false);
      if (transportFileRef.current) transportFileRef.current.value = "";
    }
  };

  const fetchRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get("/api/transport/schedules", { headers });
      const routes = response.data?.schedules || [];
      console.log("Transport API response:", response.data);
      console.log("Routes:", routes);
      setRoutes(routes);
    } catch {
      console.error("Failed to load routes");
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleSelectRoute = async (route: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post("/api/transport/select-route", { route }, { headers });
      onRouteSelected(route);
    } catch {
      alert("Failed to select route");
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Data Sources</h2>

      <div className="mt-4 space-y-3">
        {/* GMAIL ROW */}
        <div className={`flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3.5 transition-all duration-200 hover:shadow-sm ${
          gmailConnected ? "border-l-4 border-l-emerald-500 bg-emerald-50/10" : "border-l-4 border-l-slate-200 bg-white"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gmailConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Mail size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Gmail Integration</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {gmailConnected ? "Connected and scanning for deadlines" : "Automatically detect deadlines from inbox"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {gmailConnected ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <Button 
                onClick={handleConnectGmail} 
                disabled={connectingGmail}
                className="px-3 py-1.5 text-xs bg-[#6C47FF] hover:bg-[#5B3DD8] text-white rounded-lg font-semibold"
              >
                {connectingGmail ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>
        </div>

        {/* WHATSAPP ROW */}
        <div className={`rounded-xl border border-slate-100 transition-all duration-200 overflow-hidden hover:shadow-sm ${
          whatsappNumber ? "border-l-4 border-l-emerald-500 bg-emerald-50/10" : "border-l-4 border-l-slate-200 bg-white"
        }`}>
          <div 
            onClick={() => setShowWhatsapp(!showWhatsapp)}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${whatsappNumber ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <MessageCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">WhatsApp Assistant</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {whatsappNumber ? `Bot active for ${whatsappNumber}` : "Export upload & forward bot"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {whatsappNumber ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-350"></span>
                  Not Connected
                </span>
              )}
              {showWhatsapp ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </div>

          {showWhatsapp && (
            <div className="border-t border-slate-50 bg-slate-50/50 p-4 space-y-4 text-sm">
              {/* WhatsApp file upload */}
              <div>
                <p className="font-semibold text-slate-700 mb-1">WhatsApp Export Upload</p>
                <p className="text-xs text-slate-500 mb-2">Upload a WhatsApp chat export (.txt) to fetch academic tasks.</p>
                <input 
                  type="file" 
                  ref={whatsappFileRef} 
                  accept=".txt" 
                  className="hidden" 
                  onChange={handleWhatsappFileChange}
                />
                <Button 
                  variant="secondary" 
                  disabled={uploadingWhatsapp}
                  onClick={() => whatsappFileRef.current?.click()}
                  className="gap-2 px-3 py-1.5 text-xs rounded-lg"
                >
                  <Upload size={14} />
                  {uploadingWhatsapp ? "Processing chat..." : "Upload Export (.txt)"}
                </Button>
                {whatsappStatus && (
                  <p className="mt-2 text-xs font-medium text-slate-700">{whatsappStatus}</p>
                )}
              </div>

              {/* Twilio WhatsApp Forward Bot */}
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-700 mb-1">Connect WhatsApp Bot</p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button 
                    disabled={savingPhone}
                    onClick={handleSavePhone}
                    className="px-3 py-1.5 text-xs rounded-lg"
                  >
                    {savingPhone ? "Saving..." : "Save Number"}
                  </Button>
                </div>

                {whatsappNumber && (
                  <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">Setup instructions:</p>
                    <p>1. Save this contact in your phone: <strong className="font-bold">{twilioNumber}</strong></p>
                    <p>2. Forward any academic messages from your college groups to this contact.</p>
                    <p>3. The bot will automatically extract tasks and show them here in real-time!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TRANSPORT ROW */}
        <div className={`rounded-xl border border-slate-100 transition-all duration-200 overflow-hidden hover:shadow-sm ${
          selectedRoute ? "border-l-4 border-l-emerald-500 bg-emerald-50/10" : "border-l-4 border-l-slate-200 bg-white"
        }`}>
          <div 
            onClick={() => setShowTransport(!showTransport)}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedRoute ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Bus size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Transport Schedule</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedRoute ? `Route ${selectedRoute} active` : "Track bus timings and schedules"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedRoute ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-350"></span>
                  Not Connected
                </span>
              )}
              {showTransport ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </div>

          {showTransport && (
            <div className="border-t border-slate-50 bg-slate-50/50 p-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-700 mb-1">Upload Bus Schedule</p>
                <p className="text-xs text-slate-500 mb-2">Upload a PDF or image of your college bus timings.</p>
                <input 
                  type="file" 
                  ref={transportFileRef} 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  onChange={handleTransportFileChange}
                />
                <Button 
                  variant="secondary" 
                  disabled={uploadingTransport}
                  onClick={() => transportFileRef.current?.click()}
                  className="gap-2 px-3 py-1.5 text-xs rounded-lg"
                >
                  <Upload size={14} />
                  {uploadingTransport ? "Processing schedule..." : "Upload Schedule"}
                </Button>
                {transportStatus && (
                  <p className="mt-2 text-xs font-medium text-slate-700">{transportStatus}</p>
                )}
              </div>

              {/* Show schedules as selectable cards */}
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-700 mb-2">Select Your Route</p>
                {loadingRoutes ? (
                  <p className="text-xs text-slate-400">Loading routes...</p>
                ) : routes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {routes.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRoute(r.route)}
                        className={`p-3 rounded-lg border bg-white cursor-pointer transition hover:border-primary ${
                          selectedRoute === r.route ? "border-primary ring-1 ring-primary" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-800 text-xs">Route {r.route}</p>
                          {selectedRoute === r.route && (
                            <CheckCircle2 size={14} className="text-green-500" />
                          )}
                        </div>
                        <p className="text-slate-500 text-[10px] truncate">
                          Stops: {r.stops.join(" → ")}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Times: {r.departure_times.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No routes uploaded yet for your college.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CAMPUS KB ROW */}
        <div className={`flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3.5 transition-all duration-200 hover:shadow-sm ${
          kbDocCount > 0 ? "border-l-4 border-l-emerald-500 bg-emerald-50/10" : "border-l-4 border-l-slate-200 bg-white"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kbDocCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <FileText size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Campus Knowledge Base</p>
              <p className="text-xs text-slate-500 mt-0.5">{kbDocCount} document(s) uploaded for Q&A</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kbDocCount > 0 ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            ) : (
              <span className="bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-350"></span>
                Empty
              </span>
            )}
            <Button variant="secondary" onClick={onUploadDoc} className="px-3 py-1.5 text-xs rounded-lg">
              Upload
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
