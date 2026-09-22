/**
 * Typed manifest for every photo/video slot in the redesigned frontend.
 *
 * The user will supply real photography and factory footage later. Every slot is
 * declared now with its final aspect ratio and alt text, so layout never shifts when
 * an asset lands — `src: null` renders a designed placeholder plate (see
 * src/components/ui/media.tsx) instead of a broken image or an empty box.
 *
 * Adding a photo later is a one-line change here (`src: null` -> `src: r2("...")`) —
 * never a JSX edit. `pendingSlots()` gives a checklist of what's still outstanding,
 * which doubles as the photography/videography shot list.
 */

export type MediaKind = "image" | "video";
export type Aspect = "21/9" | "16/9" | "3/2" | "4/3" | "1/1" | "3/4" | "2/3";

export interface MediaAsset {
  kind: MediaKind;
  /** R2 key (via r2()), absolute URL, or null. null -> placeholder plate renders. */
  src: string | null;
  /** Video only — still frame shown before playback / while loading. */
  poster?: string | null;
  /** Written now, before the photo exists — required for a11y regardless of src. */
  alt: string;
  /** Reserves layout so swapping in the real asset causes zero reflow (zero CLS). */
  aspect: Aspect;
  /** 0–1 focal point, drives object-position when the crop doesn't match aspect. */
  focal?: { x: number; y: number };
  /** The shot-list entry — shown in the dev placeholder, doubles as the photography brief. */
  brief: string;
  caption?: string;
  credit?: string;
}

export type MediaSlotId =
  | "home.hero.primary"
  | "home.hero.alt-1"
  | "home.hero.alt-2"
  | "home.manufacturing.line"
  | "home.manufacturing.qc"
  | "home.manufacturing.tooling"
  | "home.factory.reel"
  | "about.facility.exterior"
  | "about.leadership.team"
  | "manufacturing.stage.raw-material"
  | "manufacturing.stage.precision"
  | "manufacturing.stage.quality-control"
  | "manufacturing.stage.surface-treatment"
  | "manufacturing.stage.performance-testing"
  | "manufacturing.stage.packaging"
  | "quality.lab.dimensional"
  | "quality.lab.salt-spray"
  | "quality.lab.durability"
  | "industries.motorcycle"
  | "industries.scooter"
  | "industries.electric"
  | "industries.commercial";

export const MEDIA: Record<MediaSlotId, MediaAsset> = {
  "home.hero.primary": {
    kind: "video",
    src: "/motoxplus/videos/hero-factory-master-shot.mp4",
    poster: null,
    alt: "MOTOXPLUS manufacturing floor — precision stamping and assembly of automotive spare parts",
    aspect: "16/9",
    brief:
      "Wide factory floor shot or short loop (10–20s): stamping press or assembly line in motion, workers in PPE, warm practical lighting. This is the homepage hero background — needs to read calmly at low opacity behind headline text, so avoid fast motion or bright highlights in the center-left third.",
    credit: "MOTOXPLUS India Pvt. Ltd. — factory master shot, 2026",
  },
  "home.hero.alt-1": {
    kind: "image",
    src: null,
    alt: "Finished MOTOXPLUS parts staged for quality inspection",
    aspect: "4/3",
    brief: "Close-up of finished parts (mudguards/visors/brake components) on an inspection bench, shallow depth of field.",
  },
  "home.hero.alt-2": {
    kind: "image",
    src: null,
    alt: "MOTOXPLUS packaged parts ready for dealer dispatch",
    aspect: "4/3",
    brief: "Palletized/boxed product ready for dispatch, warehouse or loading-dock setting.",
  },
  "home.manufacturing.line": {
    kind: "image",
    src: null,
    alt: "Automated production line at the MOTOXPLUS manufacturing facility",
    aspect: "3/2",
    brief: "Mid-shot of a production line, machines + at least one operator, shows scale.",
  },
  "home.manufacturing.qc": {
    kind: "image",
    src: null,
    alt: "Quality control inspection of a finished automotive part",
    aspect: "3/2",
    brief: "Inspector using a caliper/gauge on a part, clean lab or QC-bench setting.",
  },
  "home.manufacturing.tooling": {
    kind: "image",
    src: null,
    alt: "Precision tooling and dies used in MOTOXPLUS part production",
    aspect: "3/2",
    brief: "Close-up of dies/molds/tooling — the 'engineering' proof shot.",
  },
  "home.factory.reel": {
    kind: "video",
    src: "/motoxplus/videos/precision-manufacturing.mp4",
    poster: null,
    alt: "Controlled precision manufacturing at the MOTOXPLUS facility",
    aspect: "16/9",
    brief:
      "Longer factory-tour cut (30–60s) for a dedicated Manufacturing page section, can have real motion/cuts unlike the hero loop.",
    credit: "MOTOXPLUS India Pvt. Ltd. — precision manufacturing, 2026",
  },
  "about.facility.exterior": {
    kind: "image",
    src: null,
    alt: "MOTOXPLUS manufacturing facility exterior",
    aspect: "16/9",
    brief: "Exterior building shot, signage visible if possible, daytime.",
  },
  "about.leadership.team": {
    kind: "image",
    src: null,
    alt: "MOTOXPLUS leadership and team",
    aspect: "3/2",
    brief: "Team or leadership photo for the About page — optional, skip if not desired.",
  },
  "manufacturing.stage.raw-material": {
    kind: "video",
    src: "/motoxplus/videos/raw-material.mp4",
    poster: null,
    alt: "Raw material selection and incoming inspection at MOTOXPLUS",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 01: raw material selection / incoming inspection.",
    credit: "MOTOXPLUS India Pvt. Ltd. — raw material, 2026",
  },
  "manufacturing.stage.precision": {
    kind: "video",
    src: "/motoxplus/videos/cnc-precision-machining.mp4",
    poster: null,
    alt: "CNC precision machining at the MOTOXPLUS facility",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 02: precision manufacturing / CNC machining.",
    credit: "MOTOXPLUS India Pvt. Ltd. — CNC precision machining, 2026",
  },
  "manufacturing.stage.quality-control": {
    kind: "video",
    src: "/motoxplus/videos/quality-control.mp4",
    poster: null,
    alt: "Multi-point dimensional and visual quality inspection at MOTOXPLUS",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 03: multi-point dimensional + visual QC inspection.",
    credit: "MOTOXPLUS India Pvt. Ltd. — quality control, 2026",
  },
  "manufacturing.stage.surface-treatment": {
    kind: "video",
    src: "/motoxplus/videos/surface-treatment.mp4",
    poster: null,
    alt: "Surface treatment and coating stage at MOTOXPLUS",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 04: surface treatment / coating / finishing.",
    credit: "MOTOXPLUS India Pvt. Ltd. — surface treatment, 2026",
  },
  "manufacturing.stage.performance-testing": {
    kind: "video",
    src: "/motoxplus/videos/performance-testing.mp4",
    poster: null,
    alt: "Performance and functional validation testing at MOTOXPLUS",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 05: functional / performance validation testing.",
    credit: "MOTOXPLUS India Pvt. Ltd. — performance testing, 2026",
  },
  "manufacturing.stage.packaging": {
    kind: "video",
    src: "/motoxplus/videos/packaging.mp4",
    poster: null,
    alt: "Final inspection and dealer-ready packaging at MOTOXPLUS",
    aspect: "16/9",
    brief: "Six-stage timeline, stage 06: final inspection + dealer-ready packaging.",
    credit: "MOTOXPLUS India Pvt. Ltd. — packaging, 2026",
  },
  "quality.lab.dimensional": {
    kind: "image",
    src: null,
    alt: "Dimensional quality testing in the MOTOXPLUS lab",
    aspect: "4/3",
    brief: "CMM or dimensional-gauge inspection setup.",
  },
  "quality.lab.salt-spray": {
    kind: "image",
    src: null,
    alt: "Salt-spray corrosion testing chamber",
    aspect: "4/3",
    brief: "Salt-spray chamber or corrosion-test rig, if the facility has one.",
  },
  "quality.lab.durability": {
    kind: "image",
    src: null,
    alt: "Durability and stress testing equipment",
    aspect: "4/3",
    brief: "Fatigue/durability test rig, if available.",
  },
  "industries.motorcycle": {
    kind: "image",
    src: null,
    alt: "Motorcycle parts application",
    aspect: "3/2",
    brief: "Hero shot for the Industries > Motorcycles section — a motorcycle in a clean setting, or a rider on the road.",
  },
  "industries.scooter": {
    kind: "image",
    src: null,
    alt: "Scooter parts application",
    aspect: "3/2",
    brief: "Hero shot for Industries > Scooters.",
  },
  "industries.electric": {
    kind: "image",
    src: null,
    alt: "Electric two-wheeler parts application",
    aspect: "3/2",
    brief: "Hero shot for Industries > Electric — an EV two-wheeler, ideally charging or in an urban setting.",
  },
  "industries.commercial": {
    kind: "image",
    src: null,
    alt: "Commercial vehicle and load-carrier parts application",
    aspect: "3/2",
    brief: "Hero shot for Industries > Commercial — a three-wheeler or load carrier in use.",
  },
};

export function media(id: MediaSlotId): MediaAsset {
  return MEDIA[id];
}

export function isPending(asset: MediaAsset): boolean {
  return asset.src === null;
}

/** Everything still waiting on a real asset — the photography/videography shot list. */
export function pendingSlots(): MediaSlotId[] {
  return (Object.keys(MEDIA) as MediaSlotId[]).filter((id) => isPending(MEDIA[id]));
}

const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");

/** Turns an R2 object key into the absolute URL used everywhere else in the app. */
export function r2(key: string): string {
  const cleanKey = key.replace(/^\//, "");
  return R2_BASE ? `${R2_BASE}/${cleanKey}` : `/${cleanKey}`;
}
