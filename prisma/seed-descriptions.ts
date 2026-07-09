/**
 * Regenerates a unique, product-specific description for every product by parsing
 * its own name (color, vehicle model, variant markers) plus its category and
 * manufacturer/compatibility data. No two products get the same text — sentence
 * phrasing is varied per product via a deterministic hash of the product id.
 * Run: node --loader ts-node/esm prisma/seed-descriptions.ts
 * Or: npx tsx prisma/seed-descriptions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------- deterministic pseudo-random helper (stable per product id) ----------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}

// ---------- category facts ----------

interface CategoryFacts {
  kind: (name: string) => string;
  material: string[];
  durability: string[];
  installation: string[];
  application: string[];
  /** false = part is identified by a spec code (bearing no., wattage, size), not a vehicle model */
  vehicleSpecific: boolean;
}

const FACTS: Record<string, CategoryFacts> = {
  mudguard: {
    kind: (n) => (/REAR/i.test(n) ? "rear mudguard" : "front mudguard"),
    material: [
      "high-impact ABS plastic with UV-resistant, colour-stable pigments",
      "durable ABS plastic moulded with UV-stabilised pigments for consistent colour",
      "impact-grade ABS plastic treated with UV-resistant pigmentation",
    ],
    durability: [
      "a long-lasting finish that resists fading and cracking under sun and road-spray exposure",
      "colour retention and crack resistance even after prolonged outdoor and monsoon use",
      "a tough, weather-resistant shell that holds its finish through daily wear",
    ],
    installation: [
      "matches the original OEM mounting points and contours, so it bolts on without drilling or modification",
      "replicates the factory mounting holes and panel curvature for a straightforward bolt-on fit",
      "is shaped to the original panel profile, allowing quick fitment with the stock hardware",
    ],
    application: [
      "shields the wheel well from mud, water and road debris in daily commuting and monsoon riding",
      "protects the wheel arch from splash, grit and debris on both city and highway rides",
      "keeps mud and standing water off the frame and rider during everyday use",
    ],
    vehicleSpecific: true,
  },
  "head-light-visor": {
    kind: () => "headlight visor",
    material: [
      "high-grade ABS plastic finished to match the original panel colour",
      "durable ABS plastic with a factory-matched painted finish",
      "impact-grade ABS moulded and finished to original equipment colour standards",
    ],
    durability: [
      "an impact-resistant shell that holds up against stone chips and handlebar vibration",
      "a finish that resists chipping and fading through daily exposure to sun and road grit",
      "sturdy construction that keeps its shape and colour under continuous outdoor use",
    ],
    installation: [
      "is designed for direct bolt-on fitment with the original headlight shell and mounting bracket",
      "clips and bolts onto the stock headlight casing without any cutting or reshaping",
      "aligns with the factory headlight bracket for a precise, tool-free fitment",
    ],
    application: [
      "restores the factory look and weather protection around the headlight unit",
      "brings back the original cockpit styling while shielding the headlight assembly",
      "completes the front-end appearance and keeps the headlight housing properly seated",
    ],
    vehicleSpecific: true,
  },
  "ball-racer": {
    kind: () => "steering head ball racer set",
    material: [
      "caged ball bearing assemblies with hardened, precision-ground race cups",
      "hardened steel race cups paired with caged ball assemblies",
      "precision-ground steel races and caged balls sized to OEM steering-head dimensions",
    ],
    durability: [
      "a play-free steering feel that holds up over sustained use and rough roads",
      "smooth, rattle-free steering movement that stays consistent over high mileage",
      "resistance to pitting and play even under continuous rough-road use",
    ],
    installation: [
      "is supplied as a complete upper-and-lower set for straightforward installation with standard tools",
      "comes as a matched top-and-bottom set that drops into the steering head without machining",
      "installs as a full race-and-ball set, keeping the steering head geometry to factory spec",
    ],
    application: [
      "eliminates handlebar play and vibration for accurate, confident steering",
      "keeps the front end tracking straight and free of steering-head slack",
      "restores precise, low-effort steering input for daily riding",
    ],
    vehicleSpecific: true,
  },
  bearings: {
    kind: () => "precision ball bearing",
    material: [
      "ground steel races, sealed and pre-packed with high-temperature grease",
      "hardened steel races and balls, factory-sealed with high-temperature grease",
      "precision steel races finished to a fine surface grind and sealed for grease retention",
    ],
    durability: [
      "sealed construction that keeps out contamination and reduces the need for re-greasing",
      "consistent running clearance and low noise over extended service life",
      "a sealed design that resists dust and moisture ingress under everyday riding",
    ],
    installation: [
      "is manufactured to IS/ISO dimensional standards for a direct OEM swap",
      "matches standard bore, outer diameter and width tolerances for a drop-in replacement",
      "is sized to the standard bearing code for a straightforward like-for-like fit",
    ],
    application: [
      "keeps rotating assemblies running smoothly with low friction under everyday load",
      "supports wheel and drivetrain rotation with minimal drag across daily use",
      "reduces friction and heat build-up in the assembly it's fitted to",
    ],
    vehicleSpecific: false,
  },
  "brake-shoes": {
    kind: (n) => (/REAR/i.test(n) ? "rear drum brake shoe set" : /FRONT/i.test(n) ? "front drum brake shoe set" : "drum brake shoe set"),
    material: [
      "a heat-resistant friction compound bonded to precision-shaped shoe carriers",
      "friction linings bonded to shaped steel carriers for even drum contact",
      "a friction compound formulated to keep its grip across a wide temperature range",
    ],
    durability: [
      "even wear characteristics and stable friction output across load and temperature changes",
      "consistent stopping feel that doesn't fade as the drum heats up",
      "long service life with predictable wear across both wet and dry conditions",
    ],
    installation: [
      "is shaped to match the original drum profile for maximum contact area on installation",
      "seats against the stock drum geometry for full-face contact from the first fitment",
      "drops into the existing brake assembly without needing the drum to be re-machined",
    ],
    application: [
      "is a direct OEM replacement for routine drum-brake maintenance",
      "restores consistent, predictable braking for daily riding and highway use",
      "brings worn drum brakes back to original stopping performance",
    ],
    vehicleSpecific: true,
  },
  "clutch-plates": {
    kind: () => "clutch plate set",
    material: [
      "friction plates paired with precision-stamped steel drive plates",
      "friction discs matched with precision-stamped steel plates",
      "a friction-and-steel plate stack sized to the original clutch pack dimensions",
    ],
    durability: [
      "friction compound engineered for smooth engagement with minimal heat build-up under sustained use",
      "even friction wear that keeps engagement smooth well past initial break-in",
      "stable clutch feel that resists slip and glazing under repeated use",
    ],
    installation: [
      "is supplied as a complete set sized for direct OEM replacement without re-shimming",
      "comes as a full pack matched to the original plate count and thickness",
      "installs as a like-for-like set into the existing clutch housing",
    ],
    application: [
      "restores smooth clutch engagement and consistent power transfer",
      "brings back crisp, predictable clutch feel for daily gear changes",
      "eliminates slip and grabbiness from a worn clutch pack",
    ],
    vehicleSpecific: true,
  },
  "halogen-bulbs": {
    kind: () => "halogen bulb",
    material: [
      "a tungsten halogen filament matched to OEM colour temperature",
      "a halogen filament and reflective coating matched to factory brightness output",
      "a tungsten filament housed in a heat-treated glass envelope",
    ],
    durability: [
      "rated for extended service life under the vibration conditions typical of two-wheelers",
      "a filament mount built to withstand continuous road vibration",
      "consistent brightness output over its full rated service life",
    ],
    installation: [
      "is a direct socket fit that needs no wiring changes",
      "drops straight into the stock headlight socket with no rewiring",
      "matches the original bulb base and wattage for a plug-in fit",
    ],
    application: [
      "delivers bright, consistent illumination for night riding and low-visibility conditions",
      "keeps the road ahead well-lit for night and low-light riding",
      "provides steady headlight output for safe night-time visibility",
    ],
    vehicleSpecific: false,
  },
  horns: {
    kind: () => "electric horn",
    material: [
      "a compact disc-type horn body with weatherproof construction",
      "a sealed disc-type horn body built for outdoor mounting",
      "a compact horn housing with weather-sealed internals",
    ],
    durability: [
      "built for all-season use, including monsoon exposure",
      "corrosion-resistant construction suited to year-round outdoor mounting",
      "a housing that keeps working reliably through rain and heat",
    ],
    installation: [
      "fits OEM terminal connectors on standard 12V two-wheeler electrical systems",
      "connects directly to the stock 12V wiring using standard terminals",
      "bolts to the standard mounting bracket and wires in with OEM connectors",
    ],
    application: [
      "produces a clear, loud tone suitable for urban and highway riding, meeting CMVR sound-level norms",
      "gives a clear, attention-getting tone for city traffic and highway use",
      "provides dependable horn output within CMVR sound-level norms",
    ],
    vehicleSpecific: false,
  },
  indicators: {
    kind: (n) => (/REAR/i.test(n) ? "rear turn signal indicator" : /FRONT/i.test(n) ? "front turn signal indicator" : "turn signal indicator"),
    material: [
      "a polycarbonate lens housing paired with a standard-base bulb socket and OEM-grade wire connectors",
      "an impact-resistant lens housing with an OEM-spec bulb holder and connector set",
      "a moulded lens body fitted with a standard socket and factory-grade wiring leads",
    ],
    durability: [
      "UV- and impact-resistant lens material built for continuous outdoor exposure",
      "a lens that resists yellowing and cracking under prolonged sun exposure",
      "a housing that holds up to vibration and weather over daily use",
    ],
    installation: [
      "is a plug-and-play fit using the existing wiring harness and mounting stem",
      "bolts onto the stock mounting stem and wires in with the existing harness",
      "matches the factory stem and socket for a direct swap-in fit",
    ],
    application: [
      "is used for lane changes and turns, and built to meet road-compliance visibility requirements",
      "gives clear turn-signal visibility for lane changes and junctions",
      "provides dependable indicator visibility that meets road-compliance norms",
    ],
    vehicleSpecific: true,
  },
  "brake-parts": {
    kind: () => "brake shoe",
    material: ["a heat-resistant friction lining bonded to a precision-shaped steel carrier"],
    durability: ["stable friction output and even wear across temperature and load changes"],
    installation: ["is shaped to the original drum profile for full-contact seating on installation"],
    application: ["restores consistent, predictable drum-brake performance for daily riding"],
    vehicleSpecific: false,
  },
  "engine-parts": {
    kind: () => "clutch plate set",
    material: ["friction plates paired with precision-stamped steel drive plates"],
    durability: ["smooth engagement with minimal heat build-up under sustained use"],
    installation: ["is supplied as a complete set for direct OEM replacement without re-shimming"],
    application: ["restores smooth clutch engagement and consistent power transfer"],
    vehicleSpecific: false,
  },
  "body-parts": {
    kind: () => "headlight assembly",
    material: ["high-grade ABS housing with a factory-matched painted finish"],
    durability: ["a finish that resists fading and chipping under everyday outdoor exposure"],
    installation: ["matches the original mounting points and wiring layout for a direct bolt-on fit"],
    application: ["restores original front-end lighting and styling"],
    vehicleSpecific: true,
  },
};

const DEFAULT_FACTS = FACTS["body-parts"];

// ---------- colour extraction ----------

const COLOR_PATTERNS: [RegExp, string][] = [
  [/GENY\s*GREY/, "Geny Grey"],
  [/MONSOON\s*GREY/, "Monsoon Grey"],
  [/MET{1,2}AL{1,2}IC\s*GREY/, "Metallic Grey"],
  [/PARROT\s*GREEN/, "Parrot Green"],
  [/TURQ(UOISE)?\.?\s*BLUE/, "Turquoise Blue"],
  [/\bT[.\-]BLUE\b/, "Turquoise Blue"],
  [/\bM[.\-]BLUE\b/, "Metallic Blue"],
  [/\bW[.\-]RED\b/, "Wine Red"],
  [/WIN\s+RED/, "Wine Red"],
  [/\bWINE\b/, "Wine Red"],
  [/\bL[.\-]GREEN\b/, "Light Green"],
  [/SPORTS\s*RED/, "Sports Red"],
  [/\bS[.\-]RED\b/, "Sports Red"],
  [/DARK\s*GOLD/, "Dark Gold"],
  [/\bGOLDEN\b/, "Golden"],
  [/\bGOLD\b/, "Gold"],
  [/PEARL\s*WHITE/, "Pearl White"],
  [/\bMAJENTA\b/, "Magenta"],
  [/\bMAROON\b/, "Maroon"],
  [/\bBROWN\b/, "Brown"],
  [/\bVIOLET\b/, "Violet"],
  [/\bPURPLE\b/, "Purple"],
  [/\bORANGE\b/, "Orange"],
  [/\bYELLOW\b/, "Yellow"],
  [/\bGREEN\b/, "Green"],
  [/\bGRE(Y|A)\b/, "Grey"],
  [/\bGRE\b/, "Grey"], // truncated source data ("GREY" cut to "GRE")
  [/\bSILVER\b/, "Silver"],
  [/\bWHITE\b/, "White"],
  [/\bBLUE\b/, "Blue"],
  [/\bBLAC?K?\b/, "Black"],
  [/\bRED\b/, "Red"],
];

function extractColor(mainText: string, parenTexts: string[]): string | null {
  for (const [re, label] of COLOR_PATTERNS) {
    if (re.test(mainText)) {
      const isDark = /\(DARK\)/.test(mainText) || parenTexts.includes("DARK");
      if (isDark && !/^Dark /.test(label) && label !== "Dark Gold") return `Dark ${label}`;
      return label;
    }
  }
  return null;
}

function extractAccentColor(parenTexts: string[]): string | null {
  for (const p of parenTexts) {
    // matches "RED STICKER" as well as truncated source data like "RED STI" / "RED S"
    const m = p.match(/^(\w+)\s+S/);
    if (m) {
      const word = m[1];
      for (const [re, label] of COLOR_PATTERNS) {
        if (re.test(word)) return label;
      }
    }
  }
  return null;
}

// ---------- manufacturer resolution ----------

const BRAND_LABELS: Record<string, string> = {
  HERO: "Hero",
  HONDA: "Honda",
  TVS: "TVS",
  BAJAJ: "Bajaj",
  YAMAHA: "Yamaha",
  SUZUKI: "Suzuki",
};

const MODEL_TO_BRAND: [RegExp, string][] = [
  [/HERO\s*HONDA/, "Hero Honda"],
  [/\bBULLET\b/, "Royal Enfield"],
  [/\bACTIVA\b/, "Honda"],
  [/\bAPACHE\b/, "TVS"],
  [/\bCBZ\b/, "Hero"],
  [/\bCD\s*(DELUX|DLX|DAWN)/, "Hero"],
  [/\bDISCOVER\b/, "Bajaj"],
  [/\bGIXXER\b/, "Suzuki"],
  [/\bSHINE\b/, "Honda"],
  [/\bPULSAR\b/, "Bajaj"],
  [/\bR-?15\b/, "Yamaha"],
  [/\bF\s*Z\b/, "Yamaha"],
  [/\bSTAR\s*CITY\b/, "Honda"],
  [/\bSUPER\s*SPLEN[DO]OR\b/, "Hero"],
  [/\b(SUPER\s*)?XL(\s*SUPER)?\b/, "TVS"],
  [/\bACCESS\b/, "Suzuki"],
  [/\bHYATE\b/, "Suzuki"],
  [/\bJUPITER\b/, "TVS"],
  [/SPLEN[DO]OR/, "Hero"],
  [/\bSPLD?\.(?=\s|$)/, "Hero"],
  [/\bPASSION\b/, "Hero"],
  [/\bGLAMOUR\b/, "Hero"],
  [/\bHUNK\b/, "Hero"],
  [/\bPLATINA\b/, "Bajaj"],
  [/\bBOXER\b/, "Bajaj"],
  [/\bAVENGER\b/, "Bajaj"],
  [/\bCT-?100\b/, "Bajaj"],
  [/\bKB[\s-]?4S\b/, "Bajaj"],
  [/\bBAJAJ\b/, "Bajaj"],
  [/\bSUZUKI\b/, "Suzuki"],
  [/\bTVS\b/, "TVS"],
  [/\bYAMAHA\b/, "Yamaha"],
];

function resolveManufacturer(brand: string, remainderUpper: string, compat: string[]): string {
  const cleanBrand = brand.trim().toUpperCase();
  if (cleanBrand !== "MOTOXPLUS" && cleanBrand !== "XYZ" && BRAND_LABELS[cleanBrand]) {
    return BRAND_LABELS[cleanBrand];
  }
  for (const c of compat) {
    const m = c.match(/^(HERO|HONDA|TVS|BAJAJ|YAMAHA|SUZUKI)\b/i);
    if (m) return BRAND_LABELS[m[1].toUpperCase()] ?? m[1];
  }
  for (const [re, label] of MODEL_TO_BRAND) {
    if (re.test(remainderUpper)) return label;
  }
  return "leading Indian";
}

// ---------- model / variant cleanup ----------

const MODEL_WORD_FIXES: [RegExp, string][] = [
  [/\bSPLENDER\b/g, "Splendor"],
  [/\bXTREEM\b/g, "Xtreme"],
  [/\bDELUX\b/g, "Deluxe"],
  [/\bDLX\b/g, "Deluxe"],
  [/\bSPL\.(?=\s|$)/g, "Splendor"],
  [/\bSPLD\.(?=\s|$)/g, "Splendor"],
  [/\bI-SMART\b/g, "i-Smart"],
  [/\bBS[\s-]?6\b/g, "BS6"],
  [/\bDTSI\b/g, "DTSi"],
  [/\bCVTI\b/g, "CVTi"],
  [/\bF\s*Z\b/g, "FZ"],
  [/\bR-15\b/g, "R15"],
  [/\bKB[\s-]?4S\b/g, "KB4S"],
  [/\bA\/W\b/g, "Alloy Wheel"],
  [/\bW\.O\.?\b/g, ""],
  [/\bDAZIN\w*/g, "Dazzle"],
];

function titleCaseWord(w: string): string {
  if (/^\d/.test(w)) return w.toLowerCase();
  if (w.length <= 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w; // keep short codes like CT, GL, GX
  return w.charAt(0) + w.slice(1).toLowerCase();
}

function titleCaseSegment(seg: string): string {
  if (/^[A-Za-z]+$/.test(seg)) return titleCaseWord(seg);
  const m = seg.match(/^(\d+)([A-Za-z]+)$/); // "125CC" -> "125cc"
  if (m) return `${m[1]}${m[2].toLowerCase()}`;
  return seg;
}

function titleCaseToken(token: string): string {
  // handle "PLUS/PASSION" -> "Plus/Passion", "DISCOVER-135" -> "Discover-135"
  return token
    .split("/")
    .map((part) => part.split("-").map(titleCaseSegment).join("-"))
    .join("/");
}

function stripAllGlobal(text: string, patterns: [RegExp, string][]): string {
  let t = text;
  for (const [re] of patterns) {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    t = t.replace(new RegExp(re.source, flags), " ");
  }
  return t;
}

function cleanModel(text: string): string {
  let t = text;
  for (const [re, rep] of MODEL_WORD_FIXES) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), rep);
  t = t.replace(/\s+/g, " ").trim();
  t = t
    .split(" ")
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
  return t.trim();
}

// ---------- variant descriptor phrases (from parens + inline markers) ----------

// Each note is a complete, standalone sentence so it can be appended directly
// without being forced through a shared grammatical template.
function extractVariantNotes(rawUpper: string, parenTexts: string[]): string[] {
  const notes: string[] = [];

  if (/\bN\/M\b/.test(rawUpper)) {
    notes.push("This is the new-model (N/M) fitment, so please confirm your bike's variant before ordering.");
  } else if (/\bO\/M\b/.test(rawUpper)) {
    notes.push("This is the old-model (O/M) fitment, so please confirm your bike's variant before ordering.");
  }

  const hasGlass = /\bW\/?GLASS\b|\bWITH\s+GLASS\b|\bGLASS\b/.test(rawUpper) || parenTexts.some((p) => /GLASS/.test(p.toUpperCase()));
  if (hasGlass) notes.push("It is fitted with a glass lens insert.");

  for (const p of parenTexts) {
    const u = p.toUpperCase();
    if (/SELF START/.test(u)) notes.push("This is the self-start variant.");
    else if (/W\/?O\.?\s*STICKER|WITHOUT STICKER/.test(u)) notes.push("It is supplied without a decorative sticker.");
    else if (/3D STICKER/.test(u)) notes.push("It is finished with a 3D decal.");
    else if (/HORSE TYPE/.test(u)) notes.push("It is styled in the horse-type visor profile.");
    else if (/ALLOY WHEEL/.test(u)) notes.push("This variant is made for alloy-wheel models.");
    else if (/^C\.?P\.?$/.test(u)) notes.push("It has a chrome-plated (CP) finish.");
    else {
      const m = u.match(/TYPE-(\d)/);
      if (m) notes.push(`This is the Type-${m[1]} fitment variant.`);
    }
  }
  if (/LARGE PACK/.test(rawUpper)) notes.push("It is supplied in a large pack size.");
  if (/GARNISH/.test(rawUpper) && parenTexts.some((p) => /C\.?P\.?/.test(p.toUpperCase()))) {
    if (!notes.some((n) => n.includes("chrome-plated"))) notes.push("It has a chrome-plated (CP) garnish finish.");
  }
  return [...new Set(notes)];
}

// ---------- category prefix stripping ----------

const CATEGORY_PREFIXES: Record<string, string[]> = {
  mudguard: ["FRONT MUDGUARD", "REAR MUDGUARD", "MUDGUARD"],
  "head-light-visor": ["HEAD LIGHT VISOR", "HEADLIGHT VISOR", "H/L VISOR"],
  "ball-racer": ["BALL RACER"],
  bearings: ["BEARING"],
  "brake-shoes": ["BRAKE SHOE"],
  "clutch-plates": ["CLUTCH PLATE"],
  indicators: ["INDICATOR"],
  "halogen-bulbs": ["HALOGEN BULB"],
  horns: ["HORN"],
  "brake-parts": ["BRAKE SHOE", "BRAKE"],
  "engine-parts": ["CLUTCH PLATE"],
  "body-parts": ["HEAD LIGHT"],
};

function stripPrefix(nameUpper: string, categorySlug: string): string {
  const prefixes = (CATEGORY_PREFIXES[categorySlug] ?? []).slice().sort((a, b) => b.length - a.length);
  for (const pfx of prefixes) {
    if (nameUpper.startsWith(pfx)) return nameUpper.slice(pfx.length).trim();
  }
  return nameUpper;
}

function friendlyVehicleList(compat: string[]): string {
  const names = compat.map((c) => c.replace(/\s*Motorcycle$/i, "").trim());
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= 6) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.slice(0, 5).join(", ")} and other Hero/Honda models`;
}

// ---------- sentence templates ----------

const OPENERS = [
  (brand: string, model: string, product: string, kind: string) =>
    `The MOTOXPLUS ${product} is an OEM-compatible ${kind} engineered specifically for the ${brand} ${model}.`,
  (brand: string, model: string, product: string, kind: string) =>
    `Built as a precise aftermarket replacement, the MOTOXPLUS ${product} is a ${kind} designed to fit the ${brand} ${model}.`,
  (brand: string, model: string, product: string, kind: string) =>
    `MOTOXPLUS engineers this ${kind}, sold as ${product}, to the exact specifications of the ${brand} ${model}.`,
  (brand: string, model: string, product: string, kind: string) =>
    `The ${product} from MOTOXPLUS is a purpose-built ${kind} for the ${brand} ${model}, matched to original factory dimensions.`,
];

const OPENERS_MULTI = [
  (product: string, kind: string, vehicles: string) =>
    `The MOTOXPLUS ${product} is a universal-fit ${kind} engineered to suit ${vehicles}.`,
  (product: string, kind: string, vehicles: string) =>
    `Designed for broad compatibility, the MOTOXPLUS ${product} is a ${kind} that fits ${vehicles}.`,
];

const OPENERS_GENERIC = [
  (product: string, kind: string, code: string) =>
    code
      ? `The MOTOXPLUS ${product} is a precision ${kind} manufactured to the ${code} specification, offered as a direct OEM-equivalent replacement across compatible two-wheeler models.`
      : `The MOTOXPLUS ${product} is a precision ${kind} manufactured to OEM dimensional standards, offered as a direct replacement across compatible two-wheeler models.`,
  (product: string, kind: string, code: string) =>
    code
      ? `Built to the ${code} specification, the MOTOXPLUS ${product} is a ${kind} designed as a versatile OEM-equivalent replacement for two-wheelers using this standard size.`
      : `The MOTOXPLUS ${product} is a ${kind} engineered as a versatile OEM-equivalent replacement for two-wheelers using this standard specification.`,
];

const COLOR_CLAUSES = [
  (color: string) => `It carries a premium ${color} finish with UV-resistant pigments for long-lasting colour retention.`,
  (color: string) => `Finished in ${color}, it uses UV-stable pigmentation so the colour resists fading over years of outdoor use.`,
  (color: string) => `The ${color} finish is applied with UV-resistant pigments, keeping its colour consistent under sun and road exposure.`,
];

const ACCENT_CLAUSES = [
  (accent: string) => ` It also features a ${accent} accent sticker for a distinctive factory-style look.`,
  (accent: string) => ` A ${accent} accent decal completes the factory-style trim.`,
];

const MATERIAL_CLAUSES = [
  (material: string, durability: string) => `Construction uses ${material}, giving it ${durability}.`,
  (material: string, durability: string) => `It is built from ${material}, which provides ${durability}.`,
  (material: string, durability: string) => `Made from ${material}, the part delivers ${durability}.`,
];

// Shorter forms (material or installation fact only, no durability/application
// clause) used when a colour sentence is already present, to keep the whole
// paragraph inside the ~80-120 word target instead of running long.
const MATERIAL_CLAUSES_SHORT = [
  (material: string) => `It is built from ${material}.`,
  (material: string) => `Construction uses ${material}.`,
];

const INSTALL_CLAUSES = [
  (installation: string, application: string) => `Fitment is straightforward: it ${installation}. In everyday use, it ${application}.`,
  (installation: string, application: string) => `It ${installation}, and in daily use it ${application}.`,
  (installation: string, application: string) => `Installation is simple, as it ${installation} — and once fitted, it ${application}.`,
];

const INSTALL_CLAUSES_SHORT = [
  (installation: string) => `It ${installation}.`,
  (installation: string) => `Fitment-wise, it ${installation}.`,
];

const CLOSERS_INDIA = [
  () => `Manufactured in India under MOTOXPLUS's quality-controlled process, it is supplied as an aftermarket OEM-compatible replacement, not a genuine part from the original vehicle manufacturer.`,
  () => `It is manufactured in India to MOTOXPLUS's in-house quality standards and sold as an aftermarket OEM-compatible replacement, not a genuine original-manufacturer part.`,
  () => `Produced in India with consistent quality checks at every batch, this is an aftermarket OEM-compatible part and not sourced from the original vehicle manufacturer.`,
];

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// FRONT/REAR is already encoded in kind() for these categories, so strip it
// from the model text instead of repeating it (e.g. "Star City Rear").
const FRONT_REAR_IN_KIND = new Set(["brake-shoes", "indicators"]);

function generateDescription(product: { id: string; name: string; brand: string; compatibility: string[]; category: { slug: string } }): string {
  const catSlug = product.category.slug;
  const facts = FACTS[catSlug] ?? DEFAULT_FACTS;
  const nameUpper = product.name.toUpperCase();
  const seed = hashString(product.id);

  const kind = facts.kind(nameUpper);
  let remainderRaw = stripPrefix(nameUpper, catSlug);

  // Some source names are truncated (DB column length) mid-way through a
  // trailing "(...)" note, leaving an unclosed "(". Treat that dangling
  // fragment as parenthetical content too, then drop it from the main text
  // so it doesn't leak into the generated model name as raw punctuation.
  const trailingOpenParen = remainderRaw.match(/\(([^)]*)$/);
  let danglingFragment = "";
  if (trailingOpenParen) {
    danglingFragment = trailingOpenParen[1].trim();
    remainderRaw = remainderRaw.slice(0, trailingOpenParen.index).trim();
  }

  const parenTexts = [...remainderRaw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).filter(Boolean);
  if (danglingFragment) parenTexts.push(danglingFragment);
  const mainText = remainderRaw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

  const color = facts.vehicleSpecific ? extractColor(mainText, parenTexts) : null;
  const accent = color ? extractAccentColor(parenTexts) : null;
  const variantNotes = extractVariantNotes(remainderRaw, parenTexts);

  // Universal multi-fit item: name has nothing left after stripping the category prefix
  const isUniversal = facts.vehicleSpecific && mainText.length === 0 && product.compatibility.length > 1;

  let opener: string;

  if (!facts.vehicleSpecific) {
    // spec-code parts (bearings, bulbs, horns, generic single-item categories) — no vehicle claim
    const code = mainText.trim();
    opener = pick(OPENERS_GENERIC, seed, 1)(product.name, kind, code);
  } else if (isUniversal) {
    const vehicles = friendlyVehicleList(product.compatibility);
    opener = pick(OPENERS_MULTI, seed, 0)(product.name, kind, vehicles);
  } else {
    let modelText = stripAllGlobal(mainText, COLOR_PATTERNS);
    modelText = modelText.replace(/\bN\/M\b|\bO\/M\b|\bLATEST\b|\bW\/?GLASS\b|\bWITH\s+GLASS\b|\bGLASS\b/g, " ");
    if (FRONT_REAR_IN_KIND.has(catSlug)) modelText = modelText.replace(/\bFRONT\b|\bREAR\b/g, " ");
    modelText = modelText.replace(/\s+/g, " ").trim();
    const model = cleanModel(modelText) || "motorcycle";
    const manufacturer = resolveManufacturer(product.brand, remainderRaw, product.compatibility);
    opener = pick(OPENERS, seed, 1)(manufacturer, model, product.name, kind);
  }

  // A colour sentence already spends ~15-20 words, so switch the material/
  // install sentences to their shorter single-fact form to keep the whole
  // paragraph inside the ~80-120 word target instead of always running long.
  const materialSentence = color
    ? pick(MATERIAL_CLAUSES_SHORT, seed, 4)(pick(facts.material, seed, 5))
    : pick(MATERIAL_CLAUSES, seed, 4)(pick(facts.material, seed, 5), pick(facts.durability, seed, 6));
  const installSentence = color
    ? pick(INSTALL_CLAUSES_SHORT, seed, 7)(pick(facts.installation, seed, 8))
    : pick(INSTALL_CLAUSES, seed, 7)(pick(facts.installation, seed, 8), pick(facts.application, seed, 9));

  // Required sentences (always included).
  const core = [opener, ...(color ? [pick(COLOR_CLAUSES, seed, 2)(color)] : []), materialSentence, installSentence];
  const closer = pick(CLOSERS_INDIA, seed, 11)();

  // Optional embellishments (accent sticker, variant/fitment notes) are added
  // only while the running total stays inside the ~80-120 word target —
  // dropped whole rather than truncated mid-sentence if they'd overflow it.
  const optionalPool: string[] = [];
  if (accent) optionalPool.push(pick(ACCENT_CLAUSES, seed, 3)(accent).trim());
  optionalPool.push(...variantNotes.slice(0, 2));

  const sentences = [...core];
  const baseWords = wordCount([...core, closer].join(" "));
  let budget = 122 - baseWords;
  for (const extra of optionalPool) {
    const w = wordCount(extra);
    if (w <= budget) {
      sentences.push(extra);
      budget -= w;
    }
  }
  sentences.push(closer);

  return sentences.join(" ");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
  const sampleN = sampleArg ? parseInt(sampleArg.split("=")[1], 10) : 0;

  console.log("Fetching all products...\n");

  const products = await prisma.product.findMany({
    include: { category: { select: { slug: true, name: true } } },
    orderBy: { category: { name: "asc" } },
  });

  console.log(`Found ${products.length} products. Regenerating descriptions...\n`);

  let updated = 0;
  let failed = 0;
  const seen = new Map<string, string>();
  let duplicates = 0;
  let printed = 0;
  // spread sample picks across the full list rather than just the first N
  const sampleStride = sampleN > 0 ? Math.max(1, Math.floor(products.length / sampleN)) : 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const description = generateDescription({
      id: product.id,
      name: product.name,
      brand: product.brand,
      compatibility: product.compatibility,
      category: { slug: product.category.slug },
    });

    if (seen.has(description)) {
      duplicates++;
      console.warn(`  ! Duplicate text: "${product.name}" matches "${seen.get(description)}"`);
    } else {
      seen.set(description, product.name);
    }

    if (sampleN > 0 && printed < sampleN && i % sampleStride === 0) {
      const wc = description.trim().split(/\s+/).length;
      console.log(`\n--- [${product.category.name}] ${product.name} (brand=${product.brand}) — ${wc} words ---`);
      console.log(description);
      printed++;
    }

    if (dryRun) continue;

    try {
      await prisma.product.update({ where: { id: product.id }, data: { description } });
      updated++;
    } catch (err) {
      console.error(`  x Failed: ${product.name} - ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Failed: ${failed}  Duplicate texts: ${duplicates}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
