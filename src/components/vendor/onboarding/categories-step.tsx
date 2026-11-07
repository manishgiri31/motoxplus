"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PartCategoryPicker } from "@/components/catalog/part-category-picker";
import { VehicleSegmentPicker } from "@/components/catalog/vehicle-segment-picker";
import { saveCategories, type VendorApplication } from "@/lib/vendor/onboarding";
import { errorsFrom, useApplication } from "./application-context";
import { Banner, StepActions, StepPage } from "./step-page";

export function CategoriesStep() {
  return (
    <StepPage
      title="Which automotive parts do you manufacture or supply?"
      description="Choose whole groups or individual part types. Once approved, you can list products under these categories; you can't list outside them."
      backHref="/vendor/onboarding/business"
    >
      {(app) => <CategoriesForm app={app} />}
    </StepPage>
  );
}

function CategoriesForm({ app }: { app: VendorApplication }) {
  const router = useRouter();
  const { set } = useApplication();
  const [categoryIds, setCategoryIds] = React.useState<string[]>(app.categories?.categoryIds ?? []);
  const [segments, setSegments] = React.useState<string[]>(app.categories?.vehicleSegments ?? []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const locked = !app.editable;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const errs: Record<string, string> = {};
    if (categoryIds.length === 0) errs.categoryIds = "Select at least one category you manufacture or supply";
    if (segments.length === 0) errs.vehicleSegments = "Select at least one vehicle segment";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.categoryIds ? "partCategories" : "vehicleSegments-motorcycle")?.focus();
      return;
    }
    setBusy(true);
    try {
      set(await saveCategories({ categoryIds, vehicleSegments: segments }));
      router.push("/vendor/onboarding/bank");
    } catch (err) {
      const { fields, message } = errorsFrom(err);
      setErrors(fields);
      setBanner(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {banner && (
        <div className="mb-6">
          <Banner tone="error">{banner}</Banner>
        </div>
      )}
      <div className="space-y-10">
        <PartCategoryPicker
          label="Automotive parts categories"
          value={categoryIds}
          onChange={(next) => {
            setCategoryIds(next);
            if (next.length) setErrors((er) => ({ ...er, categoryIds: "" }));
          }}
          error={errors.categoryIds}
          required
          disabled={locked || busy}
        />
        <VehicleSegmentPicker
          value={segments}
          onChange={(next) => {
            setSegments(next);
            if (next.length) setErrors((er) => ({ ...er, vehicleSegments: "" }));
          }}
          error={errors.vehicleSegments}
          required
          disabled={locked || busy}
        />
      </div>
      {!locked && <StepActions backHref="/vendor/onboarding/business" busy={busy} />}
    </form>
  );
}
