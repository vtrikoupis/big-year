import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ calendars: [] }, { status: 200 });
  }
  const accessToken = (session as any).accessToken as string;
  const url =
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ calendars: [], error: text }, { status: 200 });
  }
  const data = await res.json();
  const calendars =
    (data.items || []).map((c: any) => ({
      id: c.id as string,
      summary: (c.summary as string) || "(Untitled)",
      primary: !!c.primary,
      backgroundColor: c.backgroundColor as string | undefined,
    })) ?? [];
  return NextResponse.json({ calendars });
}

