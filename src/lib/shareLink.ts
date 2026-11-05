import { sanitizeBuild } from "./share";
import type { Build } from "./types";

const FORMAT = "deflate-raw";

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encodeBuild(build: Build) {
  const bytes = new TextEncoder().encode(JSON.stringify(build));
  return toBase64Url(await pipe(bytes, new CompressionStream(FORMAT)));
}

export async function decodeBuild(value: string) {
  try {
    const bytes = await pipe(fromBase64Url(value), new DecompressionStream(FORMAT));
    return sanitizeBuild(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function extractShareData(input: string) {
  const value = input.trim();
  const hash = value.indexOf("#");
  const data = hash >= 0 ? value.slice(hash + 1) : value;
  return /^[A-Za-z0-9_-]+$/.test(data) ? data : null;
}
