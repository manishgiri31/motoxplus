/**
 * Consolidates all HEAD LIGHT VISOR products into ONE master product
 * with 229 variants selectable by Vehicle Model + Color/Type.
 *
 * Run: node scripts/setup-visor-master.mjs
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// All 229 variants from the product catalog PDF
// vehicleModel = bike model selector | extra = color/type selector
const VARIANTS = [
  // ── SPLENDER O/M ──────────────────────────────────────────────
  { vehicleModel: "SPLENDER O/M", extra: "BLACK",         partNumber: "MX-201", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER O/M", extra: "RED",           partNumber: "MX-202", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER O/M", extra: "METALLIC GREY", partNumber: "MX-203", price: 85, mrp: 322 },

  // ── SPLENDER N/M Y2K ──────────────────────────────────────────
  { vehicleModel: "SPLENDER N/M Y2K", extra: "BLACK",                  partNumber: "MX-204", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER N/M Y2K", extra: "BLACK (PURPLE STICKER)", partNumber: "MX-205", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER N/M Y2K", extra: "RED",                    partNumber: "MX-206", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER N/M Y2K", extra: "SILVER",                 partNumber: "MX-207", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER N/M Y2K", extra: "M.BLUE",                 partNumber: "MX-208", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER N/M Y2K", extra: "T.BLUE",                 partNumber: "MX-209", price: 85, mrp: 322 },

  // ── SPLENDER (W.O. STICKER) ───────────────────────────────────
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "BLACK",             partNumber: "MX-210",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "BLACK (LARGE PKG)", partNumber: "MX-211",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "BLACK (TYPE-2)",    partNumber: "MX-212",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "RED (LARGE PKG)",   partNumber: "MX-213",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "SILVER",            partNumber: "MX-214",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "M.BLUE",            partNumber: "MX-215",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "T.BLUE",            partNumber: "MX-216",  price: 85, mrp: 317 },
  { vehicleModel: "SPLENDER (W.O. STICKER)", extra: "GREEN",             partNumber: "MX-217",  price: 85, mrp: 317 },

  // ── SPLENDER PLUS ─────────────────────────────────────────────
  { vehicleModel: "SPLENDER PLUS", extra: "BLACK",           partNumber: "MX-218", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "BLACK (LARGE)",   partNumber: "MX-219", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "RED",             partNumber: "MX-220", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "RED (LARGE)",     partNumber: "MX-221", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "SILVER",          partNumber: "MX-222", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "T.BLUE",          partNumber: "MX-223", price: 85, mrp: 322 },
  { vehicleModel: "SPLENDER PLUS", extra: "M.BLUE",          partNumber: "MX-224", price: 85, mrp: 322 },

  // ── SPLENDER PLUS N/M LATEST ──────────────────────────────────
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (ALLOY WHEEL)",         partNumber: "MX-225", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (PURPLE STICKER) LARGE",partNumber: "MX-226", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (BLUE STICKER)",        partNumber: "MX-227", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (BLUE STICKER) LARGE",  partNumber: "MX-228", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (BLUE STICKER) TYPE-2", partNumber: "MX-229", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (SILVER STICKER) LARGE",partNumber: "MX-230", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "RED",                         partNumber: "MX-231", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "RED (LARGE)",                 partNumber: "MX-232", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "SILVER",                      partNumber: "MX-233", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "BLACK (PLAIN)",               partNumber: "MX-234", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PLUS N/M LATEST", extra: "RED (TYPE-2)",                partNumber: "MX-235", price: 85, mrp: 346 },

  // ── SPLENDER PRO ──────────────────────────────────────────────
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (BLUE STICKER)",       partNumber: "MX-236", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (BLUE STICKER) LARGE", partNumber: "MX-239", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (RED STICKER)",        partNumber: "MX-240", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (RED STICKER) LARGE",  partNumber: "MX-241", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (GREY STICKER)",       partNumber: "MX-242", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "BLACK (GREY STICKER) LARGE", partNumber: "MX-243", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "RED",                        partNumber: "MX-244", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "RED (TYPE-2)",               partNumber: "MX-245", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "SILVER",                     partNumber: "MX-246", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "GREY",                       partNumber: "MX-247", price: 85, mrp: 346 },
  { vehicleModel: "SPLENDER PRO", extra: "T.BLUE",                     partNumber: "MX-248", price: 85, mrp: 346 },

  // ── SPLENDER NXG ──────────────────────────────────────────────
  { vehicleModel: "SPLENDER NXG", extra: "BLACK (BLUE STICKER)",   partNumber: "MX-249", price: 85, mrp: 752 },
  { vehicleModel: "SPLENDER NXG", extra: "BLACK (RED STICKER)",    partNumber: "MX-250", price: 85, mrp: 752 },
  { vehicleModel: "SPLENDER NXG", extra: "BLACK (SILVER STICKER)", partNumber: "MX-251", price: 85, mrp: 752 },
  { vehicleModel: "SPLENDER NXG", extra: "RED",                    partNumber: "MX-252", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG", extra: "SILVER",                 partNumber: "MX-253", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG", extra: "BLUE",                   partNumber: "MX-254", price: 85, mrp: 700 },

  // ── SPLENDER NXG LATEST ───────────────────────────────────────
  { vehicleModel: "SPLENDER NXG LATEST", extra: "BLACK (BLUE STICKER)",   partNumber: "MX-255", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG LATEST", extra: "BLACK (RED STICKER)",    partNumber: "MX-256", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG LATEST", extra: "BLACK (SILVER STICKER)", partNumber: "MX-257", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG LATEST", extra: "RED",                    partNumber: "MX-258", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG LATEST", extra: "SILVER",                 partNumber: "MX-259", price: 85, mrp: 700 },
  { vehicleModel: "SPLENDER NXG LATEST", extra: "BLUE",                   partNumber: "MX-260", price: 85, mrp: 700 },

  // ── SUPER SPLENDER (W/O STICKER) ──────────────────────────────
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "BLACK",    partNumber: "MX-261", price: 85, mrp: 570 },
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "RED",      partNumber: "MX-262", price: 85, mrp: 570 },
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "WIN RED",  partNumber: "MX-263", price: 85, mrp: 570 },
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "SILVER",   partNumber: "MX-264", price: 85, mrp: 570 },
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "SKY BLUE", partNumber: "MX-265", price: 85, mrp: 570 },
  { vehicleModel: "SUPER SPLENDER (W/O STICKER)", extra: "SKY BLACK",partNumber: "MX-266", price: 85, mrp: 570 },

  // ── SUPER SPLENDER (W. STICKER) ───────────────────────────────
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "BLACK (RED STICKER)",    partNumber: "MX-267", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "BLACK (BLUE STICKER)",   partNumber: "MX-268", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "RED",                    partNumber: "MX-269", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "SILVER",                 partNumber: "MX-270", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "SKY BLUE",               partNumber: "MX-271", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "BLACK (PURPLE STICKER)", partNumber: "MX-272", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER (W. STICKER)", extra: "BLACK (GREY STICKER)",   partNumber: "MX-273", price: 85, mrp: 606 },

  // ── SUPER SPLENDER N/M ────────────────────────────────────────
  { vehicleModel: "SUPER SPLENDER N/M", extra: "RED",    partNumber: "MX-274", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER N/M", extra: "SILVER", partNumber: "MX-275", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER N/M", extra: "W.BLUE", partNumber: "MX-276", price: 85, mrp: 606 },
  { vehicleModel: "SUPER SPLENDER N/M", extra: "W.RED",  partNumber: "MX-277", price: 85, mrp: 606 },

  // ── HUNK ──────────────────────────────────────────────────────
  { vehicleModel: "HUNK", extra: "BLACK",  partNumber: "MX-278", price: 85, mrp: 640 },
  { vehicleModel: "HUNK", extra: "RED",    partNumber: "MX-279", price: 85, mrp: 640 },
  { vehicleModel: "HUNK", extra: "S.RED",  partNumber: "MX-280", price: 85, mrp: 640 },
  { vehicleModel: "HUNK", extra: "SILVER", partNumber: "MX-281", price: 85, mrp: 640 },
  { vehicleModel: "HUNK", extra: "GREY",   partNumber: "MX-282", price: 85, mrp: 640 },

  // ── PASSION ───────────────────────────────────────────────────
  { vehicleModel: "PASSION", extra: "BLACK (GOLDEN STICKER)", partNumber: "MX-283", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "BLACK (PINK STICKER)",   partNumber: "MX-284", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "RED",                    partNumber: "MX-285", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "T.BLUE",                 partNumber: "MX-286", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "M.BLUE",                 partNumber: "MX-287", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "GREY (DARK)",            partNumber: "MX-288", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "GREEN",                  partNumber: "MX-289", price: 85, mrp: 440 },
  { vehicleModel: "PASSION", extra: "BLACK (W/O STICKER) LARGE", partNumber: "MX-294", price: 85, mrp: 392 },

  // ── ACHIEVER ──────────────────────────────────────────────────
  { vehicleModel: "ACHIEVER", extra: "RED",    partNumber: "MX-290", price: 85, mrp: 775 },
  { vehicleModel: "ACHIEVER", extra: "BLACK",  partNumber: "MX-291", price: 85, mrp: 775 },
  { vehicleModel: "ACHIEVER", extra: "SILVER", partNumber: "MX-292", price: 85, mrp: 775 },
  { vehicleModel: "ACHIEVER", extra: "BLUE",   partNumber: "MX-293", price: 85, mrp: 775 },

  // ── PASSION PLUS ──────────────────────────────────────────────
  { vehicleModel: "PASSION PLUS", extra: "BLACK (BLUE STICKER)",       partNumber: "MX-295", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "BLACK (BLUE STICKER) LARGE", partNumber: "MX-296", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "BLACK (RED STICKER)",        partNumber: "MX-297", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "BLACK (RED STICKER) LARGE",  partNumber: "MX-298", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "BLACK (ORANGE STICKER)",     partNumber: "MX-299", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "WHITE RED",                  partNumber: "MX-300", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "WINE BLACK",                 partNumber: "MX-301", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "SILVER (BLUE STICKER)",      partNumber: "MX-302", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "SILVER (RED STICKER)",       partNumber: "MX-303", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "T.BLUE",                     partNumber: "MX-304", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "TURQUOISE BLUE",             partNumber: "MX-305", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "YELLOW",                     partNumber: "MX-306", price: 85, mrp: 440 },
  { vehicleModel: "PASSION PLUS", extra: "BLACK (YELLOW STICKER)",     partNumber: "MX-307", price: 85, mrp: 440 },

  // ── PASSION PLUS N/M ──────────────────────────────────────────
  { vehicleModel: "PASSION PLUS N/M", extra: "BLACK (BLUE STICKER)",       partNumber: "MX-308", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "BLACK (BLUE STICKER) LARGE", partNumber: "MX-309", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "BLACK (RED STICKER)",        partNumber: "MX-310", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "BLACK (RED STICKER) LARGE",  partNumber: "MX-311", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "SPORTS RED",                 partNumber: "MX-312", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "WINE RED",                   partNumber: "MX-313", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "SILVER",                     partNumber: "MX-314", price: 85, mrp: 450 },
  { vehicleModel: "PASSION PLUS N/M", extra: "BLUE",                       partNumber: "MX-315", price: 85, mrp: 450 },

  // ── PASSION PRO ───────────────────────────────────────────────
  { vehicleModel: "PASSION PRO", extra: "BLACK (RED STICKER)",  partNumber: "MX-316", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO", extra: "BLACK (BLUE STICKER)", partNumber: "MX-317", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO", extra: "SPORTS RED",           partNumber: "MX-318", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO", extra: "SILVER",               partNumber: "MX-319", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO", extra: "GREEN",                partNumber: "MX-320", price: 85, mrp: 660 },

  // ── PASSION PRO DIGITAL ───────────────────────────────────────
  { vehicleModel: "PASSION PRO DIGITAL", extra: "BLACK (RED STICKER)",  partNumber: "MX-321", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO DIGITAL", extra: "BLACK (BLUE STICKER)", partNumber: "MX-322", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO DIGITAL", extra: "SILVER",               partNumber: "MX-327", price: 85, mrp: 660 },
  { vehicleModel: "PASSION PRO DIGITAL", extra: "BLUE",                 partNumber: "MX-328", price: 85, mrp: 660 },

  // ── GLAMOUR O/M (with glass) ──────────────────────────────────
  { vehicleModel: "GLAMOUR O/M", extra: "BLACK (BLUE STICKER)", partNumber: "MX-329", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR O/M", extra: "BLACK (RED STICKER)",  partNumber: "MX-330", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR O/M", extra: "RED",                  partNumber: "MX-331", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR O/M", extra: "WINE RED",             partNumber: "MX-332", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR O/M", extra: "BLUE",                 partNumber: "MX-333", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR O/M", extra: "SKY BLUE",             partNumber: "MX-334", price: 85, mrp: 660 },

  // ── GLAMOUR N/M (with glass) ──────────────────────────────────
  { vehicleModel: "GLAMOUR N/M", extra: "BLACK (SILVER)",  partNumber: "MX-335", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR N/M", extra: "BLACK (RED)",     partNumber: "MX-336", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR N/M", extra: "BLACK (BLUE)",    partNumber: "MX-337", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR N/M", extra: "SPORTS RED",      partNumber: "MX-338", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR N/M", extra: "SILVER (YELLOW)", partNumber: "MX-339", price: 85, mrp: 660 },

  // ── GLAMOUR LATEST (with glass) ───────────────────────────────
  { vehicleModel: "GLAMOUR LATEST", extra: "BLACK (SILVER)", partNumber: "MX-340", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR LATEST", extra: "BLACK (RED)",    partNumber: "MX-341", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR LATEST", extra: "BLACK (BLUE)",   partNumber: "MX-342", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR LATEST", extra: "SPORTS RED",     partNumber: "MX-343", price: 85, mrp: 660 },
  { vehicleModel: "GLAMOUR LATEST", extra: "SILVER",         partNumber: "MX-344", price: 85, mrp: 660 },

  // ── CBZ EXTREME TYPE-1 (with glass) ──────────────────────────
  { vehicleModel: "CBZ EXTREME (TYPE-1)", extra: "BLACK",  partNumber: "MX-346", price: 85, mrp: 850 },
  { vehicleModel: "CBZ EXTREME (TYPE-1)", extra: "BLUE",   partNumber: "MX-347", price: 85, mrp: 850 },
  { vehicleModel: "CBZ EXTREME (TYPE-1)", extra: "RED",    partNumber: "MX-348", price: 85, mrp: 850 },
  { vehicleModel: "CBZ EXTREME (TYPE-1)", extra: "SILVER", partNumber: "MX-349", price: 85, mrp: 850 },

  // ── CD DLX O/M (SPLENDER TYPE) ───────────────────────────────
  { vehicleModel: "CD DLX O/M", extra: "BLACK",    partNumber: "MX-350",  price: 85, mrp: 400 },
  { vehicleModel: "CD DLX O/M", extra: "RED",      partNumber: "MX-351",  price: 85, mrp: 400 },
  { vehicleModel: "CD DLX O/M", extra: "WINE RED", partNumber: "MX-352W", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX O/M", extra: "SILVER",   partNumber: "MX-353",  price: 85, mrp: 400 },
  { vehicleModel: "CD DLX O/M", extra: "T.BLUE",   partNumber: "MX-354",  price: 85, mrp: 400 },

  // ── CD DELUXE N/M ─────────────────────────────────────────────
  { vehicleModel: "CD DELUXE N/M", extra: "BLACK (RED STICKER)",        partNumber: "MX-355", price: 85, mrp: 400 },
  { vehicleModel: "CD DELUXE N/M", extra: "BLACK (BLUE STICKER) LARGE", partNumber: "MX-356", price: 85, mrp: 400 },
  { vehicleModel: "CD DELUXE N/M", extra: "BLACK (BLUE STICKER)",       partNumber: "MX-357", price: 85, mrp: 400 },
  { vehicleModel: "CD DELUXE N/M", extra: "BLACK (BLUE STICKER) LARGE TYPE-2", partNumber: "MX-358", price: 85, mrp: 400 },

  // ── CD DLX N/M ────────────────────────────────────────────────
  { vehicleModel: "CD DLX N/M", extra: "RED (ORANGE STICKER)",  partNumber: "MX-359", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M", extra: "WINE RED",              partNumber: "MX-360", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M", extra: "SILVER (BLUE STICKER)", partNumber: "MX-361", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M", extra: "SILVER (RED STICKER)",  partNumber: "MX-362", price: 85, mrp: 400 },

  // ── CD DLX N/M (SELF START) ───────────────────────────────────
  { vehicleModel: "CD DLX N/M (SELF START)", extra: "BLACK (RED STICKER)",    partNumber: "MX-363", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M (SELF START)", extra: "RED (ORANGE STICKER)",   partNumber: "MX-364", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M (SELF START)", extra: "WINE RED",               partNumber: "MX-365", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M (SELF START)", extra: "BLACK (BLUE STICKER)",   partNumber: "MX-366", price: 85, mrp: 400 },
  { vehicleModel: "CD DLX N/M (SELF START)", extra: "SILVER",                 partNumber: "MX-367", price: 85, mrp: 400 },

  // ── CBZ (with glass) ──────────────────────────────────────────
  { vehicleModel: "CBZ", extra: "BLACK",  partNumber: "MX-368", price: 85, mrp: 600 },
  { vehicleModel: "CBZ", extra: "RED",    partNumber: "MX-369", price: 85, mrp: 600 },
  { vehicleModel: "CBZ", extra: "SILVER", partNumber: "MX-370", price: 85, mrp: 600 },
  { vehicleModel: "CBZ", extra: "T.BLUE", partNumber: "MX-371", price: 85, mrp: 600 },
  { vehicleModel: "CBZ", extra: "GREEN",  partNumber: "MX-372", price: 85, mrp: 600 },

  // ── CBZ STAR SILVER (with glass) ──────────────────────────────
  { vehicleModel: "CBZ STAR SILVER", extra: "BLACK (YELLOW CONE)",          partNumber: "MX-373", price: 85, mrp: 710 },
  { vehicleModel: "CBZ STAR SILVER", extra: "RED (ORANGE CONE)",            partNumber: "MX-374", price: 85, mrp: 710 },
  { vehicleModel: "CBZ STAR SILVER", extra: "BLACK SILVER (RED CONE)",      partNumber: "MX-375", price: 85, mrp: 710 },
  { vehicleModel: "CBZ STAR SILVER", extra: "T.BLUE (YELLOW CONE)",         partNumber: "MX-376", price: 85, mrp: 710 },
  { vehicleModel: "CBZ STAR SILVER", extra: "TURQUOISE BLUE (BLACK CONE)",  partNumber: "MX-377", price: 85, mrp: 710 },

  // ── CBZ XTREME TYPE-2 (with glass) ───────────────────────────
  { vehicleModel: "CBZ XTREME (TYPE-2)", extra: "BLACK",  partNumber: "MX-378", price: 85, mrp: 850 },
  { vehicleModel: "CBZ XTREME (TYPE-2)", extra: "S.RED",  partNumber: "MX-379", price: 85, mrp: 850 },
  { vehicleModel: "CBZ XTREME (TYPE-2)", extra: "ORANGE", partNumber: "MX-380", price: 85, mrp: 850 },

  // ── CBZ XTREME GARNISH ────────────────────────────────────────
  { vehicleModel: "CBZ XTREME GARNISH", extra: "CHROME PLATED", partNumber: "MX-381", price: 85, mrp: 300 },

  // ── AMBITION (with glass) ─────────────────────────────────────
  { vehicleModel: "AMBITION", extra: "BLACK",  partNumber: "MX-382", price: 85, mrp: 650 },
  { vehicleModel: "AMBITION", extra: "RED",    partNumber: "MX-383", price: 85, mrp: 650 },
  { vehicleModel: "AMBITION", extra: "MAROON", partNumber: "MX-384", price: 85, mrp: 650 },
  { vehicleModel: "AMBITION", extra: "SILVER", partNumber: "MX-385", price: 85, mrp: 650 },
  { vehicleModel: "AMBITION", extra: "BLUE",   partNumber: "MX-386", price: 85, mrp: 650 },

  // ── PLEASURE ──────────────────────────────────────────────────
  { vehicleModel: "PLEASURE", extra: "BLACK",        partNumber: "MX-387", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "RED",          partNumber: "MX-388", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "BLUE",         partNumber: "MX-390", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "WHITE",        partNumber: "MX-391", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "SPORT RED",    partNumber: "MX-392", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "SILVER",       partNumber: "MX-393", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "GREY",         partNumber: "MX-394", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "ORANGE",       partNumber: "MX-395", price: 85, mrp: 500 },
  { vehicleModel: "PLEASURE", extra: "SPRING GREEN", partNumber: "MX-396", price: 85, mrp: 500 },

  // ── UNICORN (with glass) ──────────────────────────────────────
  { vehicleModel: "UNICORN", extra: "BLACK",  partNumber: "MX-601", price: 85, mrp: 550 },
  { vehicleModel: "UNICORN", extra: "RED",    partNumber: "MX-602", price: 85, mrp: 550 },
  { vehicleModel: "UNICORN", extra: "SILVER", partNumber: "MX-603", price: 85, mrp: 550 },
  { vehicleModel: "UNICORN", extra: "T.BLUE", partNumber: "MX-604", price: 85, mrp: 550 },
  { vehicleModel: "UNICORN", extra: "GREY",   partNumber: "MX-605", price: 85, mrp: 550 },

  // ── CB UNICORN N/M (with glass) ───────────────────────────────
  { vehicleModel: "CB UNICORN N/M", extra: "BLACK",      partNumber: "MX-606", price: 85, mrp: 700 },
  { vehicleModel: "CB UNICORN N/M", extra: "RED",        partNumber: "MX-607", price: 85, mrp: 700 },
  { vehicleModel: "CB UNICORN N/M", extra: "SPORTS RED", partNumber: "MX-608", price: 85, mrp: 700 },
  { vehicleModel: "CB UNICORN N/M", extra: "SILVER",     partNumber: "MX-609", price: 85, mrp: 700 },
  { vehicleModel: "CB UNICORN N/M", extra: "ORANGE",     partNumber: "MX-610", price: 85, mrp: 700 },
  { vehicleModel: "CB UNICORN N/M", extra: "SKY BLUE",   partNumber: "MX-611", price: 85, mrp: 700 },

  // ── CB UNICORN GARNISH ────────────────────────────────────────
  { vehicleModel: "CB UNICORN GARNISH", extra: "CHROME PLATED", partNumber: "MX-612", price: 85, mrp: 400 },

  // ── SHINE O/M ─────────────────────────────────────────────────
  { vehicleModel: "CB SHINE O/M", extra: "BLACK",         partNumber: "MX-613", price: 85, mrp: 478 },
  { vehicleModel: "CB SHINE O/M", extra: "RED",           partNumber: "MX-614", price: 85, mrp: 478 },
  { vehicleModel: "CB SHINE O/M", extra: "BLUE",          partNumber: "MX-615", price: 85, mrp: 478 },
  { vehicleModel: "CB SHINE O/M", extra: "GREY",          partNumber: "MX-616", price: 85, mrp: 478 },
  { vehicleModel: "CB SHINE O/M", extra: "PURPLE (DARK)", partNumber: "MX-617", price: 85, mrp: 478 },

  // ── SHINE N/M ─────────────────────────────────────────────────
  { vehicleModel: "CB SHINE N/M", extra: "BLACK (BLUE STICKER)", partNumber: "MX-618", price: 85, mrp: 490 },
  { vehicleModel: "CB SHINE N/M", extra: "BLACK (GREY STICKER)", partNumber: "MX-619", price: 85, mrp: 490 },
  { vehicleModel: "CB SHINE N/M", extra: "GREY",                 partNumber: "MX-620", price: 85, mrp: 490 },
  { vehicleModel: "CB SHINE N/M", extra: "BLUE",                 partNumber: "MX-621", price: 85, mrp: 490 },

  // ── SHINE LATEST ──────────────────────────────────────────────
  { vehicleModel: "CB SHINE LATEST", extra: "BLACK (RED STICKER)", partNumber: "MX-622", price: 85, mrp: 625 },
  { vehicleModel: "CB SHINE LATEST", extra: "BLACK (R.RED)",       partNumber: "MX-623", price: 85, mrp: 625 },
  { vehicleModel: "CB SHINE LATEST", extra: "SPORTS RED",          partNumber: "MX-624", price: 85, mrp: 625 },
  { vehicleModel: "CB SHINE LATEST", extra: "BLUE",                partNumber: "MX-625", price: 85, mrp: 625 },
  { vehicleModel: "CB SHINE LATEST", extra: "GREY",                partNumber: "MX-626", price: 85, mrp: 625 },

  // ── CB SHINE N/M (TYPE-5) ─────────────────────────────────────
  { vehicleModel: "CB SHINE N/M (TYPE-5)", extra: "SILVER",       partNumber: "MX-627", price: 85, mrp: 560 },
  { vehicleModel: "CB SHINE N/M (TYPE-5)", extra: "GENY GREY",    partNumber: "MX-628", price: 85, mrp: 560 },
  { vehicleModel: "CB SHINE N/M (TYPE-5)", extra: "MONSOON GREY", partNumber: "MX-629", price: 85, mrp: 560 },
];

async function main() {
  console.log("🚀 Starting HEAD LIGHT VISOR master product setup...\n");

  // 1. Get Body Parts category
  const category = await prisma.category.findFirst({
    where: { OR: [{ slug: "body-parts" }, { name: { contains: "Body", mode: "insensitive" } }] },
  });
  if (!category) throw new Error("Body Parts category not found. Please create it first.");
  console.log(`✓ Category: ${category.name}`);

  // 2. Deactivate ALL existing visor products
  const deactivated = await prisma.product.updateMany({
    where: { name: { contains: "visor", mode: "insensitive" } },
    data: { isActive: false },
  });
  console.log(`✓ Deactivated ${deactivated.count} existing visor products`);

  // 3. Also deactivate H/L VISOR products
  const deactivated2 = await prisma.product.updateMany({
    where: { name: { contains: "H/L VISOR", mode: "insensitive" } },
    data: { isActive: false },
  });
  console.log(`✓ Deactivated ${deactivated2.count} H/L VISOR products`);

  // 4. Delete variants on any existing visor-named products (cleanup)
  const existingVisorProducts = await prisma.product.findMany({
    where: { name: { contains: "visor", mode: "insensitive" } },
    select: { id: true },
  });
  if (existingVisorProducts.length > 0) {
    await prisma.productVariant.deleteMany({
      where: { productId: { in: existingVisorProducts.map(p => p.id) } },
    });
    console.log(`✓ Cleaned up variants from ${existingVisorProducts.length} old visor products`);
  }

  // 5. Check if master product already exists
  let master = await prisma.product.findFirst({
    where: { sku: "MX-VISOR-MASTER" },
  });

  if (master) {
    // Clean up existing variants
    await prisma.productVariant.deleteMany({ where: { productId: master.id } });
    master = await prisma.product.update({
      where: { id: master.id },
      data: { isActive: true },
    });
    console.log(`✓ Reusing existing master product (variants reset)`);
  } else {
    // 6. Create ONE master HEAD LIGHT VISOR product
    master = await prisma.product.create({
      data: {
        name: "HEAD LIGHT VISOR",
        sku: "MX-VISOR-MASTER",
        partNumber: "MX-VISOR",
        description: "Premium quality head light visors for Hero and Honda motorcycles. Available for Splender, Passion, Glamour, CBZ, Unicorn, Shine and many more models. Select your vehicle model and color below.",
        categoryId: category.id,
        price: 85,
        mrp: 750,
        moq: 10,
        gstRate: 18,
        hsnCode: "87141090",
        brand: "HERO / HONDA",
        warranty: "12 Months",
        countryOfOrigin: "India",
        compatibility: [
          "HERO Motorcycle", "HONDA Motorcycle",
          "Splender", "Splender Plus", "Splender NXG", "Splender Pro",
          "Super Splender", "Passion", "Passion Plus", "Passion Pro",
          "Hunk", "Achiever", "Glamour", "CBZ", "CD Deluxe",
          "Unicorn", "CB Shine", "Pleasure", "Ambition",
        ],
        stock: 0,
        isActive: true,
      },
    });
    console.log(`✓ Created master product: ${master.id}`);
  }

  // 7. Create all variants
  console.log(`\n⏳ Creating ${VARIANTS.length} variants...`);
  let created = 0;

  for (let i = 0; i < VARIANTS.length; i++) {
    const v = VARIANTS[i];
    await prisma.productVariant.create({
      data: {
        productId: master.id,
        label: `${v.vehicleModel} — ${v.extra}`,
        vehicleModel: v.vehicleModel,
        extra: v.extra,
        partNumber: v.partNumber,
        sku: v.partNumber,
        price: v.price,
        mrp: v.mrp,
        stock: 1000,
        moq: 10,
        sortOrder: i,
        isActive: true,
        imageUrl: null, // Add images via admin panel
      },
    });
    created++;
    if (created % 20 === 0) process.stdout.write(`  ${created}/${VARIANTS.length}...\n`);
  }

  console.log(`\n✅ Done!`);
  console.log(`   Master product ID : ${master.id}`);
  console.log(`   Variants created  : ${created}`);
  console.log(`   Vehicle models    : ${[...new Set(VARIANTS.map(v => v.vehicleModel))].length}`);
  console.log(`\n👉 Open: localhost:3000/products/${master.id}`);
  console.log(`   Add images via: localhost:3000/admin/products/${master.id}/edit`);
}

main()
  .catch((e) => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
