"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { getCategory } from "@/lib/categories";
import { specs } from "@/lib/specs";
import { criteriaSpecs } from "@/lib/criteria";
import CatalogueChooser from "@/components/CatalogueChooser";
import CriteriaChooser from "@/components/CriteriaChooser";

export default function ChoosePage() {
  const { category: categoryId } = useParams<{ category: string }>();
  const category = getCategory(categoryId);
  if (!category || !category.available) notFound();

  const criteria = criteriaSpecs[category.id];
  const spec = specs[category.id];
  if (!criteria && !spec) notFound();

  return (
    <>
      <Link href="/" className="btn-ghost back-link">
        ← Retour à ma configuration
      </Link>
      {criteria ? <CriteriaChooser category={category} spec={criteria} /> : <CatalogueChooser category={category} spec={spec!} />}
    </>
  );
}
