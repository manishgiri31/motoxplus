/** Vehicle segments a supplier makes parts for. Values mirror the Prisma `VehicleSegment` enum. */
export const VEHICLE_SEGMENTS = [
  { value: "MOTORCYCLE", label: "Motorcycles" },
  { value: "SCOOTER", label: "Scooters" },
  { value: "THREE_WHEELER", label: "Three-Wheelers" },
  { value: "PASSENGER_CAR", label: "Passenger Cars" },
  { value: "COMMERCIAL_VEHICLE", label: "Commercial Vehicles" },
  { value: "OTHER", label: "Other Vehicles" },
] as const;

export type VehicleSegmentValue = (typeof VEHICLE_SEGMENTS)[number]["value"];

export const VEHICLE_SEGMENT_VALUES = VEHICLE_SEGMENTS.map((s) => s.value) as [VehicleSegmentValue, ...VehicleSegmentValue[]];

export function vehicleSegmentLabel(value: string): string {
  return VEHICLE_SEGMENTS.find((s) => s.value === value)?.label ?? value;
}
