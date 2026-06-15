"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, Users, Plus, X, Award, Info, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

export interface ClubEvent {
  id: string;
  college: string;
  club_name: string;
  event_name: string;
  event_date: string;
  venue: string;
  description: string;
  registration_deadline: string;
  eligibility: string;
  category: string;
  open_to: string;
  created_at: string;
}

export default function ClubEvents() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [clubName, setClubName] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [category, setCategory] = useState("general");
  const [openTo, setOpenTo] = useState("all");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await api.get("/api/clubs/events", { headers });
      setEvents(res.data || []);
    } catch (err) {
      console.error("Failed to load club events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName || !eventName || !eventDate || !venue || !description || !registrationDeadline || !eligibility) {
      alert("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await api.post(
        "/api/clubs/events",
        {
          club_name: clubName.trim(),
          event_name: eventName.trim(),
          event_date: eventDate,
          venue: venue.trim(),
          description: description.trim(),
          registration_deadline: registrationDeadline,
          eligibility: eligibility.trim(),
          category,
          open_to: openTo.trim(),
        },
        { headers }
      );

      // Reset form
      setClubName("");
      setEventName("");
      setEventDate("");
      setVenue("");
      setDescription("");
      setRegistrationDeadline("");
      setEligibility("");
      setCategory("general");
      setOpenTo("all");

      setShowModal(false);
      fetchEvents();
      alert("Club event published successfully!");
    } catch (err) {
      console.error("Failed to create event:", err);
      alert("Failed to publish club event. Make sure you are authenticated.");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "technical":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "cultural":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "sports":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  // Check if deadline is past or within 48h
  const getDeadlineAlert = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: "Registration Closed", style: "text-red-500 bg-red-50 border-red-100" };
    }
    if (diffDays <= 2) {
      return { text: `Closes in ${diffDays} day${diffDays === 1 ? "" : "s"}!`, style: "text-amber-600 bg-amber-50 border-amber-100" };
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Campus Club Events</h2>
          <p className="text-xs text-slate-500">Discover and participate in college activities</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-1.5 px-3 py-2 text-xs rounded-xl">
          <Plus size={14} />
          Post Event
        </Button>
      </div>

      <div className="flex-1 mt-4 overflow-y-auto max-h-[350px] space-y-3 pr-1">
        {loading ? (
          <p className="text-center py-8 text-xs text-slate-400">Loading events...</p>
        ) : events.length > 0 ? (
          events.map((event) => {
            const deadlineAlert = getDeadlineAlert(event.registration_deadline);
            return (
              <div
                key={event.id}
                className="group p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md hover:border-slate-200 transition duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {event.club_name}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-sm mt-0.5 group-hover:text-primary transition">
                      {event.event_name}
                    </h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-semibold rounded-full border ${getCategoryColor(event.category)}`}>
                    {event.category}
                  </span>
                </div>

                <p className="text-slate-500 text-xs mt-2 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-4 pt-3 border-t border-slate-50 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    <span>{formatDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-400" />
                    <span className="truncate">{event.venue}</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Users size={13} className="text-slate-400" />
                    <span className="truncate">Open to: {event.open_to} (Eligibility: {event.eligibility})</span>
                  </div>
                </div>

                {/* Registration deadline alert */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50/50">
                  <span className="text-[10px] text-slate-400">
                    Deadline: {formatDate(event.registration_deadline)}
                  </span>
                  {deadlineAlert && (
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border font-medium ${deadlineAlert.style}`}>
                      <AlertTriangle size={10} />
                      {deadlineAlert.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-slate-50/50 border border-dashed border-slate-100 rounded-xl">
            <Award className="mx-auto text-slate-300 mb-2" size={24} />
            <p className="text-xs font-medium text-slate-500">No upcoming club events</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Be the first to post a campus activity!</p>
          </div>
        )}
      </div>

      {/* Post Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900">Publish Club Event</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Club Name</label>
                  <input
                    type="text"
                    required
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="e.g. Innovators Club"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Event Name</label>
                  <input
                    type="text"
                    required
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Hackathon 2026"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain event details, prizes, timelines, etc..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Registration Deadline</label>
                  <input
                    type="date"
                    required
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Venue</label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Main Audi / Lab 5"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-xs"
                  >
                    <option value="technical">Technical</option>
                    <option value="cultural">Cultural</option>
                    <option value="sports">Sports</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Eligibility Criteria</label>
                  <input
                    type="text"
                    required
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    placeholder="e.g. CGPA >= 7.5, Python basic"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Open To</label>
                  <input
                    type="text"
                    required
                    value={openTo}
                    onChange={(e) => setOpenTo(e.target.value)}
                    placeholder="e.g. All Students / B.Tech 3rd Yr"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="rounded-xl px-4 py-2 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="rounded-xl px-4 py-2 text-xs">
                  {submitting ? "Publishing..." : "Publish Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
