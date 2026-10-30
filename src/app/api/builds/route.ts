import { NextResponse } from "next/server";
import { sanitizeBuild } from "@/lib/share";
import { saveBuild } from "@/lib/shareStore";

const MAX_BODY = 50000;

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > MAX_BODY) return NextResponse.json({ error: "Cette configuration est trop volumineuse." }, { status: 413 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "La requête est mal formée." }, { status: 400 });
  }

  const build = sanitizeBuild(parsed);
  if (!build) return NextResponse.json({ error: "Cette configuration est vide ou incomplète." }, { status: 400 });

  const code = await saveBuild(build);
  return NextResponse.json({ code });
}
