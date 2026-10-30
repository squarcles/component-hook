"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useBuild } from "@/lib/build";
import BuildView from "@/components/BuildView";
import type { Build } from "@/lib/types";

type State = { status: "loading" } | { status: "found"; build: Build } | { status: "missing" };

export default function SharedBuildPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { build: current, replaceBuild } = useBuild();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch(`/api/builds/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setState(data?.build ? { status: "found", build: data.build } : { status: "missing" }))
      .catch(() => setState({ status: "missing" }));
  }, [code]);

  const importBuild = (build: Build) => {
    if (Object.keys(current).length && !window.confirm("Cette configuration remplacera la vôtre. Souhaitez-vous continuer ?")) return;
    replaceBuild(build);
    router.push("/");
  };

  return (
    <>
      <h1>Configuration partagée · {code.toUpperCase()}</h1>

      {state.status === "loading" && <p className="hint">Chargement...</p>}

      {state.status === "missing" && (
        <>
          <p className="error">Aucune configuration ne correspond à ce code. Vérifiez qu&apos;il est correctement saisi.</p>
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
