"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBuild } from "@/lib/build";
import { decodeBuild } from "@/lib/shareLink";
import BuildView from "@/components/BuildView";
import type { Build } from "@/lib/types";

type State = { status: "loading" } | { status: "found"; build: Build } | { status: "missing" };

export default function SharedBuildPage() {
  const router = useRouter();
  const { build: current, replaceBuild } = useBuild();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const read = () => {
      const data = window.location.hash.slice(1);
      if (!data) return setState({ status: "missing" });
      decodeBuild(data).then((build) => setState(build ? { status: "found", build } : { status: "missing" }));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const importBuild = (build: Build) => {
    if (Object.keys(current).length && !window.confirm("Cette configuration remplacera la vôtre. Souhaitez-vous continuer ?")) return;
    replaceBuild(build);
    router.push("/");
  };

  return (
    <>
      <h1>Configuration partagée</h1>

      {state.status === "loading" && <p className="hint">Chargement...</p>}

      {state.status === "missing" && (
        <>
          <p className="error">Ce lien de partage est incomplet ou invalide. Vérifiez qu&apos;il a été copié en entier.</p>
          <Link href="/" className="btn">
            Retour
          </Link>
        </>
      )}

      {state.status === "found" && (
        <>
          <p className="hint">Les prix affichés sont ceux relevés lors du partage et ont pu évoluer depuis.</p>
          <BuildView build={state.build} />
          <div className="share">
            <button className="btn" onClick={() => importBuild(state.build)}>
              Utiliser cette configuration
            </button>
          </div>
        </>
      )}
    </>
  );
}
