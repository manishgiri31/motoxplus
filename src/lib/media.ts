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
  | "manufacturing.process.stamping"
  | "manufacturing.process.plating"
  | "manufacturing.process.assembly"
  | "manufacturing.process.packaging"
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
    src: null,
    poster: null,
    alt: "MOTOXPLUS manufacturing floor — precision stamping and assembly of automotive spare parts",
    aspect: "16/9",
    brief:
      "Wide factory floor shot or short loop (10–20s): stamping press or assembly line in motion, workers in PPE, warm practical lighting. This is the homepage hero background — needs to read calmly at low opacity behind headline text, so avoid fast motion or bright highlights in the center-left third.",
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
    src: null,
    poster: null,
    alt: "MOTOXPLUS factory tour — from raw material to packaged part",
    aspect: "16/9",
    brief:
      "Longer factory-tour cut (30–60s) for a dedicated Manufacturing page section, can have real motion/cuts unlike the hero loop.",
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
  "manufacturing.process.stamping": {
    kind: "image",
    src: null,
    alt: "Sheet-metal stamping stage of the manufacturing process",
    aspect: "1/1",
    brief: "Process-rail step 1: stamping. Square crop for the process-step rail.",
  },
  "manufacturing.process.plating": {
    kind: "image",
    src: null,
    alt: "Surface plating and finishing stage of the manufacturing process",
    aspect: "1/1",
    brief: "Process-rail step 2: plating/finishing. Square crop.",
  },
  "manufacturing.process.assembly": {
    kind: "image",
    src: null,
    alt: "Assembly stage of the manufacturing process",
    aspect: "1/1",
    brief: "Process-rail step 3: assembly. Square crop.",
  },
  "manufacturing.process.packaging": {
    kind: "image",
    src: null,
    alt: "Packaging and dispatch stage of the manufacturing process",
    aspect: "1/1",
    brief: "Process-rail step 4: packaging/dispatch. Square crop.",
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
