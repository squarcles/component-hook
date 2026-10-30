"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { catalogue } from "@/lib/categories";
import { useBuild } from "@/lib/build";
import { candidateProblems } from "@/lib/compat";
import type { CategorySpec } from "@/lib/specs";
import type { Category, Product } from "@/lib/types";
import OfferPicker from "./OfferPicker";

type Props = { category: Category; spec: CategorySpec };

export default function CatalogueChooser({ category, spec }: Props) {
  const router = useRouter();
  const { build, setPart } = useBuild();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [compatibleOnly, setCompatibleOnly] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);

  const products = catalogue[category.id] || [];

  const withProblems = products.map((p) => ({
    product: p,
    problems: candidateProblems(build, category.id, { merchantId: "", productId: p.id }),
  }));

  const rows = withProblems.filter(
    ({ product, problems }) =>
      `${product.brand} ${product.name}`.toLowerCase().includes(search.toLowerCase()) &&
      spec.filters.every((f) => !filters[f.label] || f.value(product) === filters[f.label]) &&
      (!compatibleOnly || problems.length === 0),
  );

  const hiddenCount = withProblems.filter((r) => r.problems.length > 0).length;

  return (
    <>
      <h1>Choisir : {category.name}</h1>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Rechercher un modèle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {spec.filters.map((f) => (
          <select
            key={f.label}
            className="select"
            value={filters[f.label] || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, [f.label]: e.target.value }))}
          >
            <option value="">{f.label} : tous</option>
            {[...new Set(products.map(f.value))].sort().map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        {hiddenCount > 0 && (
          <label className="checkbox">
            <input type="checkbox" checked={compatibleOnly} onChange={(e) => setCompatibleOnly(e.target.checked)} />
            Masquer les modèles incompatibles ({hiddenCount})
          </label>
        )}
      </div>

      <table className="products">
        <thead>
          <tr>
            <th>Modèle</th>
            {spec.columns.map((c) => (
              <th key={c.label} className={c.mobile ? undefined : "hide-mobile"}>
                {c.label}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, problems }) => (
            <tr key={product.id} className={problems.length ? "incompatible" : undefined}>
              <td>
                {product.brand} {product.name}
                {problems.map((p) => (
                  <div key={p} className="problem">
                    {p}
                  </div>
                ))}
              </td>
              {spec.columns.map((c) => (
                <td key={c.label} className={c.mobile ? undefined : "hide-mobile"}>
                  {c.value(product)}
                </td>
              ))}
              <td>
                <button className="btn" onClick={() => setSelected(product)}>
                  Choisir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <OfferPicker
          title={`${selected.brand} ${selected.name}`}
          search={{ query: spec.query(selected), keywords: spec.keywords(selected), exclude: spec.exclude, reject: spec.reject }}
          onClose={() => setSelected(null)}
          onTake={(merchant, offer) => {
            setPart(category.id, { productId: selected.id, merchantId: merchant.id, offer });
            router.push("/");
          }}
        />
      )}
    </>
  );
}
