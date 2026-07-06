import { prisma } from "@/lib/prisma";

const KEY_GST_REQUIRED = "verification_gst_required";
const KEY_PAN_REQUIRED = "verification_pan_required";
const KEY_GST_REQUIRED_CATEGORIES = "verification_gst_required_categories";

export interface VerificationConfig {
  gstRequired: boolean;
  panRequired: boolean;
  gstRequiredCategories: string[];
}

export async function getVerificationConfig(): Promise<VerificationConfig> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [KEY_GST_REQUIRED, KEY_PAN_REQUIRED, KEY_GST_REQUIRED_CATEGORIES] } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  let gstRequiredCategories: string[] = [];
  try {
    gstRequiredCategories = map[KEY_GST_REQUIRED_CATEGORIES] ? JSON.parse(map[KEY_GST_REQUIRED_CATEGORIES]) : [];
  } catch {
    gstRequiredCategories = [];
  }

  return {
    gstRequired: map[KEY_GST_REQUIRED] === "true",
    panRequired: map[KEY_PAN_REQUIRED] === "true",
    gstRequiredCategories,
  };
}

// `category` is a dealer/vendor segment identifier (e.g. a VendorCategory value
// or a future dealer tier) — used once mandatory GST verification is scoped to
// specific segments rather than applied globally.
export async function isGstRequiredFor(category?: string | null): Promise<boolean> {
  const config = await getVerificationConfig();
  if (config.gstRequired) return true;
  if (category && config.gstRequiredCategories.includes(category)) return true;
  return false;
}

export async function setVerificationConfig(update: Partial<VerificationConfig>): Promise<void> {
  const updates: { key: string; value: string }[] = [];
  if (update.gstRequired !== undefined) updates.push({ key: KEY_GST_REQUIRED, value: String(update.gstRequired) });
  if (update.panRequired !== undefined) updates.push({ key: KEY_PAN_REQUIRED, value: String(update.panRequired) });
  if (update.gstRequiredCategories !== undefined) {
    updates.push({ key: KEY_GST_REQUIRED_CATEGORIES, value: JSON.stringify(update.gstRequiredCategories) });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );
}
