import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createListing,
  emptyForm,
  formFromListing,
  listListings,
  orderedErrors,
  payoutEstimate,
  photoProblem,
  priceOrderErrors,
  publishListing,
  publishProblems,
  toInput,
  unpublishListing,
  updateListing,
  uploadListingImage,
  validateFormat,
  type Listing,
  type ListingFormValues,
} from "./listings";

function complete(overrides: Partial<ListingFormValues> = {}): ListingFormValues {
  return {
    ...emptyForm(),
    title: "Front brake pad set for Splendor",
    brand: "Kumar Friction",
    categoryId: "cat-pads",
    partNumber: "45105-KWP-901",
    sku: "KF-BP-001",
    hsnCode: "8714",
    stock: "25",
    mrp: "499",
    retailPrice: "449",
    dealerPrice: "320",
    ...overrides,
  };
}

describe("price rules (same as ListingRules.java)", () => {
  it("accepts MRP >= retail >= dealer, including equal prices", () => {
    expect(validateFormat(complete())).toEqual({});
    expect(validateFormat(complete({ mrp: "400", retailPrice: "400", dealerPrice: "400" }))).toEqual({});
  });

  it("puts the ordering error on the lower price that is out of place", () => {
    expect(validateFormat(complete({ retailPrice: "550" }))).toEqual({ retailPrice: "Retail price can't be higher than the MRP" });
    expect(validateFormat(complete({ dealerPrice: "460" }))).toEqual({ dealerPrice: "Dealer price can't be higher than the retail price" });
    expect(priceOrderErrors(300, null, 350)).toEqual({ dealerPrice: "Dealer price can't be higher than the MRP" });
    expect(priceOrderErrors(null, null, 350)).toEqual({});
  });

  it("requires every price to be a whole rupee amount above zero", () => {
    expect(validateFormat(complete({ mrp: "0" })).mrp).toBe("MRP must be more than ₹0");
    expect(validateFormat(complete({ retailPrice: "-1" })).retailPrice).toBe("Retail price must be more than ₹0");
    expect(validateFormat(complete({ dealerPrice: "319.50" })).dealerPrice).toBe("Dealer price must be a whole rupee amount");
    expect(validateFormat(complete({ mrp: "abc" })).mrp).toBe("Enter the MRP as a number");
    expect(validateFormat(complete({ mrp: "10,00,001" })).mrp).toBe("MRP can't be more than ₹10,00,000");
    // Indian digit grouping and a rupee sign are fine.
    expect(validateFormat(complete({ mrp: "₹1,299", retailPrice: "1,199", dealerPrice: "999" }))).toEqual({});
  });

  it("does not report an ordering error on top of a price that is itself invalid", () => {
    expect(validateFormat(complete({ mrp: "0", retailPrice: "449" }))).toEqual({ mrp: "MRP must be more than ₹0" });
  });
});

describe("publish rules", () => {
  it("a draft with only a title is valid to save but lists everything missing to publish, in editor order", () => {
    const draft = { ...emptyForm(), title: "Clutch cable" };
    expect(validateFormat(draft)).toEqual({});
    expect(Object.keys(publishProblems(draft, 0))).toEqual([
      "categoryId",
      "brand",
      "partNumber",
      "sku",
      "images",
      "mrp",
      "retailPrice",
      "dealerPrice",
      "stock",
      "hsnCode",
    ]);
  });

  it("is ready once every required field, one photo and stock are present", () => {
    expect(publishProblems(complete(), 1)).toEqual({});
    expect(publishProblems(complete(), 0)).toEqual({ images: "Add at least one photo" });
    expect(publishProblems(complete({ stock: "0" }), 1)).toEqual({ stock: "Add at least 1 unit of stock" });
    expect(publishProblems(complete({ stock: "4", moq: "10" }), 1)).toEqual({ stock: "Stock must cover your minimum order quantity (10)" });
  });

  it("orders mixed errors like the editor", () => {
    expect(Object.keys(orderedErrors({ hsnCode: "x", sku: "x", title: "x", images: "x" }))).toEqual(["title", "sku", "images", "hsnCode"]);
  });

  it("checks tax codes, identifiers and fitment years", () => {
    const e = validateFormat(complete({ hsnCode: "871", gstRate: "12", sku: "has space", partNumber: "!" }));
    expect(Object.keys(e).sort()).toEqual(["gstRate", "hsnCode", "partNumber", "sku"]);
    expect(validateFormat(complete({ hsnCode: "8714 10 90" }))).toEqual({});
    const fit = (yearFrom: string, yearTo: string) =>
      validateFormat(complete({ fitment: [{ vehicleId: "v1", vehicleName: "Splendor", manufacturer: "Hero", yearFrom, yearTo }] }));
    expect(fit("2015", "2020")).toEqual({});
    expect(fit("2020", "2015").fitment).toBe("A vehicle's 'from' year must not be after its 'to' year");
    expect(fit("1900", "").fitment).toBe("Years must be between 1950 and 2100");
  });
});

describe("toInput", () => {
  it("sends clean values and never an ownership or status field", () => {
    const input = toInput(
      complete({
        title: "  Front   brake pad  ",
        mrp: "1,299",
        retailPrice: "1199",
        dealerPrice: "999",
        hsnCode: "8714 10 90",
        description: "  ",
        fitment: [{ vehicleId: "v1", vehicleName: "Splendor", manufacturer: "Hero", yearFrom: "2015", yearTo: "" }],
      })
    );
    expect(input.title).toBe("Front brake pad");
    expect(input.mrp).toBe(1299);
    expect(input.hsnCode).toBe("87141090");
    expect(input.description).toBeNull();
    expect(input.fitment).toEqual([{ vehicleId: "v1", yearFrom: 2015, yearTo: null }]);
    for (const forbidden of ["vendorId", "userId", "status", "productId", "commission"]) {
      expect(input).not.toHaveProperty(forbidden);
    }
  });

  it("round-trips a listing from the API through the form", () => {
    const listing = {
      id: "l1",
      status: "LIVE",
      title: "Disc rotor",
      brand: "Kumar",
      categoryName: "Brake Discs",
      categoryId: "c1",
      partNumber: "PN-1",
      sku: "S-1",
      mrp: 900,
      retailPrice: 850,
      dealerPrice: 600,
      stock: 12,
      description: null,
      hsnCode: "8714",
      gstRate: 18,
      moq: 2,
      warranty: null,
      countryOfOrigin: "India",
      weightGrams: 800,
      images: [],
      fitment: [{ vehicleId: "v1", vehicleName: "Pulsar 150", manufacturer: "Bajaj", yearFrom: 2019, yearTo: null }],
      readiness: { ready: true, problems: {} },
      storefront: { visible: true, url: "/products/disc-rotor" },
      firstPublishedAt: null,
      publishedAt: null,
      unpublishedAt: null,
      createdAt: "",
      updatedAt: "",
    } satisfies Listing;
    const input = toInput(formFromListing(listing));
    expect(input).toMatchObject({ title: "Disc rotor", mrp: 900, retailPrice: 850, dealerPrice: 600, stock: 12, moq: 2, gstRate: 18 });
    expect(input.fitment).toEqual([{ vehicleId: "v1", yearFrom: 2019, yearTo: null }]);
  });
});

describe("payout estimate", () => {
  it("takes the configured commission off the selling price, rounding half-up to the paisa", () => {
    expect(payoutEstimate(449, 1500)).toEqual({ commission: 67.35, payout: 381.65 });
    expect(payoutEstimate(320, 1500)).toEqual({ commission: 48, payout: 272 });
    // 0.15 * 0.10 = 0.015 -> 0.02 (half-up), as Money.percentBp does in Java.
    expect(payoutEstimate(0.1, 1500)).toEqual({ commission: 0.02, payout: 0.08 });
    expect(payoutEstimate(100, 0)).toEqual({ commission: 0, payout: 100 });
  });
});

describe("photo pre-check", () => {
  const file = (size: number, type: string) => ({ size, type, name: "x" }) as File;
  it("allows JPG, PNG and WEBP up to 5 MB", () => {
    expect(photoProblem(file(1000, "image/jpeg"))).toBeUndefined();
    expect(photoProblem(file(1000, "image/webp"))).toBeUndefined();
    expect(photoProblem(file(5 * 1024 * 1024 + 1, "image/png"))).toBe("Photo is too large (max 5 MB)");
    expect(photoProblem(file(1000, "image/gif"))).toBe("Use a JPG, PNG or WEBP photo");
    expect(photoProblem(file(0, "image/png"))).toBe("This file is empty");
  });
});

describe("API calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch() {
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: "l1" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("hits /api/v1/vendors/me/listings with the session cookie and no vendor id anywhere", async () => {
    const f = stubFetch();
    await createListing(toInput(complete()));
    await updateListing("l 1", toInput(complete()));
    await publishListing("l1");
    await unpublishListing("l1");
    await listListings({ status: "LIVE", q: " pads ", page: 2 });

    const calls = f.mock.calls.map(([url, init]) => [url, (init as RequestInit).method ?? "GET"]);
    expect(calls).toEqual([
      ["/api/v1/vendors/me/listings", "POST"],
      ["/api/v1/vendors/me/listings/l%201", "PUT"],
      ["/api/v1/vendors/me/listings/l1/publish", "POST"],
      ["/api/v1/vendors/me/listings/l1/unpublish", "POST"],
      ["/api/v1/vendors/me/listings?status=LIVE&q=pads&page=2", "GET"],
    ]);
    for (const [url, init] of f.mock.calls) {
      expect((init as RequestInit).credentials).toBe("include");
      expect(String(url)).not.toMatch(/vendorId|userId/);
      const body = (init as RequestInit).body;
      if (typeof body === "string") expect(body).not.toMatch(/"(vendorId|userId|status|productId)"/);
    }
  });

  it("uploads a photo as multipart with only the file", async () => {
    const f = stubFetch();
    await uploadListingImage("l1", new File([new Uint8Array([0xff, 0xd8, 0xff])], "pad.jpg", { type: "image/jpeg" }));
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/v1/vendors/me/listings/l1/images");
    const body = (init as RequestInit).body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
  });
});
