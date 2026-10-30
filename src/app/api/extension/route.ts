import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createZip } from "@/lib/zip";

const EXTENSION_DIR = path.join(process.cwd(), "extension");
const FOLDER = "component-hook-extension";

export async function GET() {
  const names = (await readdir(EXTENSION_DIR, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
  const files = await Promise.all(
    names.map(async (name) => ({ name: `${FOLDER}/${name}`, data: await readFile(path.join(EXTENSION_DIR, name)) })),
  );
  const zip = createZip(files);

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${FOLDER}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
