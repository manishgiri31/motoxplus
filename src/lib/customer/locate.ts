import { matchIndianState, PINCODE_REGEX, INDIAN_STATES } from "./signup";

export interface LocatedAddress {
  address: string;
  city: string;
  state: (typeof INDIAN_STATES)[number] | "";
  pincode: string;
}

export class LocateError extends Error {}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new LocateError("Your browser can't share location. Enter the address below."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new LocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is off. Allow it in your browser, or enter the address below."
            : "Couldn't find your location. Enter the address below."
        )
      );
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

interface NominatimAddress {
  house_number?: string;
  building?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
}

/**
 * Fills the delivery address from the device's location. Only runs when the
 * customer taps "Use current location"; the coordinates go to OpenStreetMap's
 * Nominatim reverse geocoder (no key, browser-side, one request per tap) and
 * nowhere else. House number is rarely known, so the form asks the customer
 * to check the first line.
 */
export async function locateAddress(): Promise<LocatedAddress> {
  const pos = await currentPosition();
  const { latitude, longitude } = pos.coords;

  let a: NominatimAddress;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    a = ((await res.json()) as { address?: NominatimAddress }).address ?? {};
  } catch {
    throw new LocateError("Couldn't look up an address for your location. Enter it below.");
  }
  if (a.country_code && a.country_code !== "in") {
    throw new LocateError("We deliver within India only. Enter an Indian address below.");
  }

  const line = [a.house_number, a.building, a.road, a.neighbourhood ?? a.quarter ?? a.suburb ?? a.hamlet]
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(", ");
  const pincode = (a.postcode ?? "").replace(/\s/g, "");

  return {
    address: line,
    city: a.city ?? a.town ?? a.village ?? a.city_district ?? a.county ?? a.state_district ?? "",
    state: matchIndianState(a.state) ?? "",
    pincode: PINCODE_REGEX.test(pincode) ? pincode : "",
  };
}
