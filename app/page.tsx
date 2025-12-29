'use client';
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { YearCalendar, AllDayEvent } from "@/components/year-calendar";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [events, setEvents] = useState<AllDayEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [calendars, setCalendars] = useState<{ id: string; summary: string; primary?: boolean; backgroundColor?: string }[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "authenticated") {
      fetch(`/api/events?year=${year}${selectedCalendarIds.length ? `&calendarIds=${encodeURIComponent(selectedCalendarIds.join(','))}` : ""}`)
        .then((res) => res.json())
        .then((data) => setEvents(data.events || []))
        .catch(() => setEvents([]));
    } else {
      setEvents([]);
    }
  }, [status, year, selectedCalendarIds]);

  useEffect(() => {
    if (status !== "authenticated") {
      setCalendars([]);
      setSelectedCalendarIds([]);
      return;
    }
    fetch(`/api/calendars`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = (data.calendars || []) as { id: string; summary: string; primary?: boolean; backgroundColor?: string }[];
        setCalendars(list);
        setSelectedCalendarIds(list.map((c) => c.id));
        // Load colors from localStorage, default to API backgroundColor or a soft palette
        try {
          const stored = JSON.parse(localStorage.getItem("calendarColors") || "{}");
          const next: Record<string, string> = { ...(stored || {}) };
          for (const c of list) {
            if (!next[c.id]) {
              next[c.id] = c.backgroundColor || "#cbd5e1"; // slate-300 fallback
            }
          }
          setCalendarColors(next);
          localStorage.setItem("calendarColors", JSON.stringify(next));
        } catch {
          const next: Record<string, string> = {};
          for (const c of list) next[c.id] = c.backgroundColor || "#cbd5e1";
          setCalendarColors(next);
          localStorage.setItem("calendarColors", JSON.stringify(next));
        }
      })
      .catch(() => {
        setCalendars([]);
        setSelectedCalendarIds([]);
        setCalendarColors({});
      });
  }, [status]);

  const onPrev = () => setYear((y) => y - 1);
  const onNext = () => setYear((y) => y + 1);
  const onRefresh = async () => {
    if (status !== "authenticated") {
      setEvents([]);
      return;
    }
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/events?year=${year}${selectedCalendarIds.length ? `&calendarIds=${encodeURIComponent(selectedCalendarIds.join(','))}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // keep existing events on failure
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="grid grid-cols-3 items-center p-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            ☰
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={onPrev} aria-label="Previous year">
            ←
          </Button>
          <div className="font-semibold text-lg min-w-[5ch] text-center">{year}</div>
          <Button variant="secondary" onClick={onNext} aria-label="Next year">
            →
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={isRefreshing} aria-label="Refresh events">
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/60 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-card border-r shadow-lg flex flex-col"
            role="dialog"
            aria-label="Menu"
          >
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold">Calendars</div>
              <Button size="sm" variant="secondary" onClick={() => setSelectedCalendarIds(calendars.map((c) => c.id))}>
                Select all
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
              {status === "authenticated" ? (
                calendars.map((c) => {
                  const checked = selectedCalendarIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-accent">
                      <input
                        type="checkbox"
                        className="accent-foreground"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedCalendarIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          );
                        }}
                      />
                      <span className="truncate flex-1">{c.summary}</span>
                      {c.primary && <span className="text-[10px] text-muted-foreground">primary</span>}
                      <input
                        type="color"
                        value={calendarColors[c.id] || "#cbd5e1"}
                        onChange={(e) => {
                          const next = { ...calendarColors, [c.id]: e.target.value };
                          setCalendarColors(next);
                          try {
                            localStorage.setItem("calendarColors", JSON.stringify(next));
                          } catch {}
                        }}
                        className="h-5 w-5 rounded border p-0"
                        aria-label={`Color for ${c.summary}`}
                        title={`Color for ${c.summary}`}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground p-2">Sign in to manage calendars.</div>
              )}
              {status === "authenticated" && calendars.length === 0 && (
                <div className="text-sm text-muted-foreground p-2">No calendars</div>
              )}
            </div>
            <div className="p-3 border-t">
              {status === "authenticated" ? (
                <Button className="w-full" variant="outline" onClick={() => { setSidebarOpen(false); signOut(); }}>
                  Sign out
                </Button>
              ) : (
                <Button className="w-full" onClick={() => { setSidebarOpen(false); signIn("google"); }}>
                  Sign in with Google
                </Button>
              )}
            </div>
          </aside>
        </>
      )}
      <div className="flex-1 min-h-0">
        <YearCalendar year={year} events={events} signedIn={status === "authenticated"} calendarColors={calendarColors} />
      </div>
    </div>
  );
}


