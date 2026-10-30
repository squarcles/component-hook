"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELIVERY_LIMITS, useBuild } from "@/lib/build";
import { CODE_LENGTH, CODE_PATTERN } from "@/lib/share";
import BuildView from "@/components/BuildView";

type ShareState = { status: "idle" } | { status: "loading" } | { status: "done"; code: string } | { status: "error"; error: string };

export default function HomePage() {
  const router = useRouter();
  const { build, removePart, maxDelivery, setMaxDelivery } = useBuild();
  const [share, setShare] = useState<ShareState>({ status: "idle" });
  const [copied, setCopied] = useState("");
  const [openCode, setOpenCode] = useState("");

  const empty = Object.keys(build).length === 0;
  const normalizedCode = openCode.trim().toUpperCase();

  const createShare = async () => {
    setShare({ status: "loading" });
    try {
      const response = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(build),
      });
      const data = await response.json();
      setShare(response.ok ? { status: "done", code: data.code } : { status: "error", error: data.error });
    } catch {
      setShare({ status: "error", error: "Le serveur est injoignable pour le moment. Veuillez réessayer." });
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {}
  };

  const shareLink = share.status === "done" ? `${window.location.origin}/b/${share.code}` : "";

  return (
    <>
      <h1>Ma configuration</h1>
      <label className="setting">
        <span>Délai de livraison</span>
        <select className="select" value={maxDelivery} onChange={(e) => setMaxDelivery(Number(e.target.value))}>
          {DELIVERY_LIMITS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="hint">Les offres plus longues à livrer sont présentées séparément.</span>
      </label>
      <BuildView build={build} onRemove={removePart} />

      <div className="share">
        <div className="share-block">
          <button className="btn" disabled={empty || share.status === "loading"} onClick={createShare}>
            {share.status === "loading" ? "Création du code..." : "Partager ma configuration"}
          </button>
          {share.status === "done" && (
            <div className="share-result">
              <span>
                Code : <strong className="share-code">{share.code}</strong>
              </span>
              <button className="btn-ghost" onClick={() => copy(share.code)}>
                {copied === share.code ? "Copié" : "Copier le code"}
              </button>
              <button className="btn-ghost" onClick={() => copy(shareLink)}>
                {copied === shareLink ? "Copié" : "Copier le lien"}
              </button>
            </div>
          )}
          {share.status === "error" && <span className="error">{share.error}</span>}
        </div>

        <form
          className="share-block"
          onSubmit={(e) => {
            e.preventDefault();
            if (CODE_PATTERN.test(normalizedCode)) router.push(`/b/${normalizedCode}`);
          }}
        >
          <input
            className="input share-input"
            placeholder="Code de partage"
            maxLength={CODE_LENGTH}
            value={openCode}
            onChange={(e) => setOpenCode(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!CODE_PATTERN.test(normalizedCode)}>
            Ouvrir
          </button>
        </form>
      </div>
    </>
  );
}
