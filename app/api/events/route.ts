import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function startOfYearIso(year: number) {
  return new Date(Date.UTC(year, 0, 1)).toISOString();
}
function endOfYearIso(year: number) {
  return new Date(Date.UTC(year + 1, 0, 1)).toISOString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(
    searchParams.get("year") || `${new Date().getFullYear()}`,
    10
  );
  const calendarIdsParam = searchParams.get("calendarIds") || "";
  const calendarIds = calendarIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ events: [] }, { status: 200 });
  }

  const accessToken = (session as any).accessToken as string;

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: startOfYearIso(year),
    timeMax: endOfYearIso(year),
    maxResults: "2500",
  });

  const idsToFetch = calendarIds.length > 0 ? calendarIds : ["primary"];
  const fetches = idsToFetch.map(async (cid) => {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      cid
    )}/events?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { items: [] as any[] };
    }
    const data = await res.json();
    return { items: data.items || [], calendarId: cid };
  });
 
  const results = await Promise.all(fetches);
  const events = results.flatMap((r) =>
    (r.items || [])
      .filter((e: any) => e?.start?.date && e.status !== "cancelled")
      .map((e: any) => ({
        id: `${r.calendarId || "primary"}:${e.id}`,
        calendarId: r.calendarId || "primary",
        summary: e.summary || "(Untitled)",
        startDate: e.start.date as string,
        endDate: e.end?.date as string,
      }))
  );

  return NextResponse.json({ events });
}


