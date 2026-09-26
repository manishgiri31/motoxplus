const fs = require('fs');
let content = fs.readFileSync('src/lib/media.ts', 'utf-8');

content = content.replace(/\/motoxplus\/videos\/hero-factory-master-shot\.mp4/g, '/videos/HERO FACTORY MASTER SHOT.mp4');
content = content.replace(/\/motoxplus\/videos\/precision-manufacturing\.mp4/g, '/videos/PRECISION MANUFACTURING.mp4');
content = content.replace(/\/motoxplus\/videos\/raw-material\.mp4/g, '/videos/RAW MATERIAL.mp4');
content = content.replace(/\/motoxplus\/videos\/cnc-precision-machining\.mp4/g, '/videos/CNC PRECISION MACHINING.mp4');
content = content.replace(/\/motoxplus\/videos\/quality-control\.mp4/g, '/videos/QUALITY CONTROL.mp4');
content = content.replace(/\/motoxplus\/videos\/surface-treatment\.mp4/g, '/videos/SURFACE TREATMENT.mp4');
content = content.replace(/\/motoxplus\/videos\/performance-testing\.mp4/g, '/videos/PERFORMANCE TESTING.mp4');
content = content.replace(/\/motoxplus\/videos\/packaging\.mp4/g, '/videos/PACKAGING.mp4');

if (!content.includes('"manufacturing.stage.cnc"')) {
    content = content.replace('export type MediaSlotId =\n', \export type MediaSlotId =
  | "home.dealer-network"
  | "home.brand-scale"
  | "home.final-cta"
  | "manufacturing.stage.final-inspection"
  | "manufacturing.stage.cnc"\n\);

    content = content.replace('export const MEDIA: Record<MediaSlotId, MediaAsset> = {\\n', \export const MEDIA: Record<MediaSlotId, MediaAsset> = {
  "home.dealer-network": {
    kind: "video",
    src: "/videos/INDIA DEALER NETWORK.mp4",
    alt: "MOTOXPLUS Dealer Network Across India",
    aspect: "16/9",
    brief: "Dispatch and logistics connecting factory to dealers.",
  },
  "home.brand-scale": {
    kind: "video",
    src: "/videos/PRODUCT CATEGORY MONTAGE.mp4",
    alt: "MOTOXPLUS Product Categories and Brand Scale",
    aspect: "16/9",
    brief: "Brand scale montage.",
  },
  "home.final-cta": {
    kind: "video",
    src: "/videos/galaxy-eyes.3840x2160.mp4",
    alt: "MOTOXPLUS Final Cinematic Vision",
    aspect: "16/9",
    brief: "Final cinematic brand closing for CTA.",
  },
  "manufacturing.stage.final-inspection": {
    kind: "video",
    src: "/videos/PRODUCT MACRO HERO.mp4",
    alt: "Final Inspection of MOTOXPLUS components",
    aspect: "16/9",
    brief: "Product macro hero shot representing final check before packaging.",
  },
  "manufacturing.stage.cnc": {
    kind: "video",
    src: "/videos/CNC PRECISION MACHINING.mp4",
    alt: "CNC Component Manufacturing at MOTOXPLUS",
    aspect: "16/9",
    brief: "Component manufacturing and machining.",
  },\n\);
}

fs.writeFileSync('src/lib/media.ts', content);
