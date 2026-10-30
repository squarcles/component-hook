import { randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CODE_ALPHABET, CODE_LENGTH, CODE_PATTERN } from "./share";
import type { Build } from "./types";

const DIR = path.join(process.cwd(), "data", "builds");
const MAX_ATTEMPTS = 10;

type Stored = { build: Build; createdAt: string };

const fileOf = (code: string) => path.join(DIR, `${code}.json`);

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export async function saveBuild(build: Build) {
  await mkdir(DIR, { recursive: true });
  const data: Stored = { build, createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    try {
      await writeFile(fileOf(code), JSON.stringify(data), { flag: "wx" });
      return code;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error("Impossible de générer un code unique");
}

export async function loadBuild(code: string) {
  if (!CODE_PATTERN.test(code)) return null;
  try {
    const data = JSON.parse(await readFile(fileOf(code), "utf8")) as Stored;
    return data.build;
  } catch {
    return null;
  }
}
