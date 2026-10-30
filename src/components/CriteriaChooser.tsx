"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuild } from "@/lib/build";
import { candidateProblems } from "@/lib/compat";
import Link from "next/link";
import { getCategory } from "@/lib/categories";
import { normalizeCriteria, type CriteriaSpec } from "@/lib/criteria";
import type { Category, CriteriaValues } from "@/lib/types";
import OfferPicker from "./OfferPicker";

type Props = { category: Category; spec: CriteriaSpec };

export default function CriteriaChooser({ category, spec }: Props) {
  const router = useRouter();
  const { build, loaded, setPart } = useBuild();
  const [values, setValues] = useState<CriteriaValues | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!loaded || values) return;
    setValues(normalizeCriteria(spec, build[category.id]?.criteria ?? spec.defaults(build), build));
  }, [build, loaded, category.id, spec, values]);

  if (!loaded) return null;

  if (spec.requires && !build[spec.requires.category]) {
    return (
      <div className="criteria-page">
        <h1>Choisir : {category.name}</h1>
        <p className="hint">{spec.requires.message}</p>
        <Link href={`/choisir/${spec.requires.category}`} className="btn btn-big">
          Choisir : {getCategory(spec.requires.category)?.name}
        </Link>
      </div>
    );
  }

  if (!values) return null;

  const problems = candidateProblems(build, category.id, { merchantId: "", criteria: values });
  const update = (key: string, value: string) => setValues(normalizeCriteria(spec, { ...values, [key]: value }, build));
  const hint = spec.hint?.(values, build);

  return (
    <div className="criteria-page">
      <h1>Choisir : {category.name}</h1>
      {hint && <p className="hint">{hint}</p>}

      <div className="criteria">
        {spec.fields.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <select className="select" value={values[f.key]} onChange={(e) => update(f.key, e.target.value)}>
              {f.options(values, build).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {problems.length > 0 && (
        <ul className="warnings">
          {problems.map((p) => (
            <li key={p} className="warning">
              {p}
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-big" onClick={() => setPicking(true)}>
        Chercher les offres
      </button>

      {picking && (
        <OfferPicker
          title={`${category.name} · ${spec.label(values)}`}
          search={spec.search(values)}
          onClose={() => setPicking(false)}
          onTake={(merchant, offer) => {
            setPart(category.id, { merchantId: merchant.id, criteria: values, offer });
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
