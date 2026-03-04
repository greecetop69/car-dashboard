export interface InspectionDamageItem {
  part: string;
  statuses: string[];
  attributes: string[];
}

export interface InspectionSummary {
  vehicleId: number;
  notFound: boolean;
  vin: string | null;
  modelYear: string | null;
  firstRegistrationDate: string | null;
  mileage: number | null;
  transmission: string | null;
  accident: boolean | null;
  simpleRepair: boolean | null;
  waterlog: boolean | null;
  damages: InspectionDamageItem[];
  replacedParts: string[];
  fetchedAt: string;
}
