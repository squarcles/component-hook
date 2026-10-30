import { NextResponse } from "next/server";
import { loadBuild } from "@/lib/shareStore";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const build = await loadBuild(code.toUpperCase());
  if (!build) return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
  return NextResponse.json({ build });
}
