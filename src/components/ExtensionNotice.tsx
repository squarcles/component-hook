"use client";

import { useEffect, useState } from "react";
import { hasExtension } from "@/lib/extension";
import { merchants } from "@/lib/merchants";

const DISMISS_KEY = "pcfinder-extension-notice-dismissed";
const STORE_URL = "";

export default function ExtensionNotice() {
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hasExtension().then((present) => {
      if (present) return;
      setMissing(true);
      try {
        setOpen(sessionStorage.getItem(DISMISS_KEY) !== "1");
      } catch {
        setOpen(true);
      }
    });
  }, []);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (!missing) return null;

  return (
    <>
      <div className="extension-banner">
        L&apos;extension Component Hook n&apos;est pas installée : les prix ne peuvent pas s&apos;afficher directement
        sur le site.
        <button className="link-btn" onClick={() => setOpen(true)}>
          En savoir plus
        </button>
      </div>

      {open && (
        <div className="overlay" onClick={close}>
          <div className="modal modal-notice" onClick={(e) => e.stopPropagation()}>
            <h2>Pourquoi Component Hook utilise-t-il une extension ?</h2>

            <p>
              Pour des raisons de sécurité, un navigateur interdit à un site de lire le contenu d&apos;un autre site.
              Component Hook ne peut donc pas consulter lui-même les prix d&apos;Amazon, de LDLC ou de la Fnac. Nous
              refusons par ailleurs tout partenariat commercial et tout lien affilié, afin que le classement des offres
              reste parfaitement neutre. L&apos;extension est le seul moyen d&apos;afficher les prix ici sans dépendre
              des marchands.
            </p>

            <div className="notice-columns">
              <div>
                <h3>Ce qu&apos;elle fait</h3>
                <ul>
                  <li>Elle n&apos;agit que lorsque vous lancez une recherche de prix sur Component Hook.</li>
                  <li>
                    Elle ouvre alors une fenêtre de navigation privée, réduite dans la barre des tâches, et y consulte
                    les pages de recherche et les fiches produits des marchands.
                  </li>
                  <li>Elle y relève le prix, le délai de livraison et, si vous le demandez, les avis récents.</li>
                  <li>Elle transmet ces informations à cette page, puis referme la fenêtre.</li>
                </ul>
              </div>
              <div>
                <h3>Ce qu&apos;elle ne fait pas</h3>
                <ul>
                  <li>
                    Elle n&apos;accède ni à vos comptes, ni à vos cookies, ni à votre historique : la navigation privée
                    est totalement séparée de votre session habituelle.
                  </li>
                  <li>Elle ne fonctionne que sur Component Hook et sur les {merchants.length} sites marchands listés.</li>
                  <li>Elle n&apos;envoie aucune donnée à nos serveurs et ne contient ni publicité ni pistage.</li>
                  <li>Elle n&apos;effectue aucun achat et ne remplit aucun formulaire.</li>
                </ul>
              </div>
            </div>

            <p className="hint">
              Sites concernés : {merchants.map((m) => m.name).join(", ")}. Autorisations demandées : ouvrir et fermer
              des onglets, lire le contenu de ces sites, fonctionner en navigation privée. Son code tient en quatre
              fichiers lisibles, inclus dans l&apos;archive.
            </p>

            <h3>Installation</h3>
            {STORE_URL ? (
              <a className="btn btn-big" href={STORE_URL} target="_blank" rel="noreferrer">
                Ajouter à Chrome
              </a>
            ) : (
              <>
                <a className="btn btn-big" href="/api/extension" download>
                  Télécharger l&apos;extension
                </a>
                <ol className="install-steps">
                  <li>Décompressez l&apos;archive téléchargée.</li>
                  <li>
                    Ouvrez <code>chrome://extensions</code> (ou <code>edge://extensions</code>) et activez le « Mode
                    développeur ».
                  </li>
                  <li>Cliquez sur « Charger l&apos;extension non empaquetée » et sélectionnez le dossier décompressé.</li>
                  <li>Dans « Détails », activez « Autoriser en mode navigation privée ».</li>
                  <li>Rechargez cette page.</li>
                </ol>
              </>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={() => window.location.reload()}>
                J&apos;ai installé l&apos;extension
              </button>
              <button className="btn-ghost" onClick={close}>
                Continuer sans l&apos;extension
              </button>
            </div>
            <p className="hint">
              Sans l&apos;extension, le site reste utilisable : il ouvre la recherche directement sur le site du
              marchand.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
