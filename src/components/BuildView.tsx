"use client";

import Link from "next/link";
import { categories, getProduct } from "@/lib/categories";
import { getMerchant } from "@/lib/merchants";
import { formatPrice } from "@/lib/match";
import { buildProblems } from "@/lib/compat";
import { criteriaSpecs } from "@/lib/criteria";
import type { Build, BuildPart, Category, CategoryId } from "@/lib/types";

type Props = {
  build: Build;
  onRemove?: (category: CategoryId) => void;
};

export function buildTotal(build: Build) {
  return Object.values(build).reduce((sum, part) => sum + (part?.offer?.price ?? 0), 0);
}

function partName(category: Category, part: BuildPart) {
  const product = part.productId ? getProduct(category.id, part.productId) : undefined;
  const spec = criteriaSpecs[category.id];
  return product?.name ?? (part.criteria && spec ? spec.label(part.criteria) : null);
}

function PartDetails({ category, part }: { category: Category; part: BuildPart }) {
  const name = partName(category, part);
  if (!name) return <>Aucun composant sélectionné</>;
  return (
    <>
      <strong>{name}</strong> · {getMerchant(part.merchantId)?.name}
      {part.offer && (
        <>
          {" · "}
          <a href={part.offer.url} target="_blank" rel="noreferrer noopener">
            {formatPrice(part.offer.price)}
          </a>
          {part.criteria && <span className="offer-line">{part.offer.title}</span>}
          {part.offer.suspicious && <span className="offer-warning">{part.offer.suspicious}</span>}
          {part.offer.reviewWarning && <span className="offer-warning">{part.offer.reviewWarning}</span>}
        </>
      )}
    </>
  );
}

export default function BuildView({ build, onRemove }: Props) {
  const editable = Boolean(onRemove);
  const problems = buildProblems(build);
  const total = buildTotal(build);
  const main = categories.filter((c) => !c.accessory && (editable || build[c.id]));
  const accessories = categories.filter((c) => c.accessory);
  const chosenAccessories = accessories.filter((c) => build[c.id]);

  const actions = (category: Category, small = false) => (
    <span className="actions">
      {build[category.id] && (
        <button className={small ? "btn-ghost btn-small" : "btn-ghost"} onClick={() => onRemove!(category.id)}>
          Retirer
        </button>
      )}
      <Link href={`/choisir/${category.id}`} className={small ? "btn btn-small" : "btn"}>
        {build[category.id] ? "Changer" : "Choisir"}
      </Link>
    </span>
  );

  return (
    <>
      {problems.length > 0 && (
        <ul className="warnings">
          {problems.map((p) => (
            <li key={p} className="warning">
              {p}
            </li>
          ))}
        </ul>
      )}
      <div className="build-table">
        {main.map((category) => {
          const part = build[category.id];
          return (
            <div key={category.id} className={editable ? "build-row" : "build-row build-row-readonly"}>
              <span className="label">{category.name}</span>
              <span className="part">{part ? <PartDetails category={category} part={part} /> : "Rien pour l'instant"}</span>
              {editable && actions(category)}
            </div>
          );
        })}

        {(editable || chosenAccessories.length > 0) && (
          <div className="build-row build-row-readonly">
            <span className="label">Accessoires / Autres</span>
            <span className="part">
              {editable && (
                <span className="accessory-links">
                  {accessories.map((c, i) => (
                    <span key={c.id}>
                      <Link href={`/choisir/${c.id}`}>{c.name}</Link>
                      {i < accessories.length - 1 && ", "}
                    </span>
                  ))}
                </span>
              )}
              {chosenAccessories.map((category) => (
                <span key={category.id} className="accessory-item">
                  <span>
                    <span className="accessory-name">{category.name} :</span>{" "}
                    <PartDetails category={category} part={build[category.id]!} />
                  </span>
                  {editable && actions(category, true)}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="total">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      )}
    </>
  );
}
