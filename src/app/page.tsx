"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELIVERY_LIMITS, useBuild } from "@/lib/build";
import { encodeBuild, extractShareData } from "@/lib/shareLink";
import BuildView from "@/components/BuildView";

type ShareState = { status: "idle" } | { status: "loading" } | { status: "done"; link: string } | { status: "error"; error: string };

export default function HomePage() {
  const router = useRouter();
  const { build, removePart, maxDelivery, setMaxDelivery } = useBuild();
  const [share, setShare] = useState<ShareState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [openLink, setOpenLink] = useState("");

  const empty = Object.keys(build).length === 0;
  const openData = extractShareData(openLink);

  const createShare = async () => {
    setShare({ status: "loading" });
    setCopied(false);
    try {
      const data = await encodeBuild(build);
      setShare({ status: "done", link: `${window.location.origin}/b#${data}` });
    } catch {
      setShare({ status: "error", error: "Le lien n'a pas pu être créé avec ce navigateur." });
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {}
  };

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
            {share.status === "loading" ? "Création du lien..." : "Partager ma configuration"}
          </button>
          {share.status === "done" && (
            <div className="share-result">
              <input className="input share-input" readOnly value={share.link} onFocus={(e) => e.target.select()} />
              <button className="btn-ghost" onClick={() => copy(share.link)}>
                {copied ? "Copié" : "Copier le lien"}
              </button>
            </div>
          )}
          {share.status === "error" && <span className="error">{share.error}</span>}
        </div>

        <form
          className="share-block"
          onSubmit={(e) => {
            e.preventDefault();
            if (openData) router.push(`/b#${openData}`);
          }}
        >
          <input
            className="input share-input"
            placeholder="Lien de partage"
            value={openLink}
            onChange={(e) => setOpenLink(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!openData}>
            Ouvrir
          </button>
        </form>
      </div>
    </>
  );
}
