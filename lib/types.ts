export type UserRole = "owner" | "property_manager" | "contractor" | "bookkeeper";

export type PropertyStatus =
  | "prospect"
  | "under_contract"
  | "owned_renovating"
  | "owned_rented"
  | "owned_vacant"
  | "sold";

export type DealStage =
  | "sourcing"
  | "analyzing"
  | "offer_submitted"
  | "under_contract"
  | "closed_won"
  | "closed_lost";

export interface Property {
  id: string;
  address: string;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: PropertyStatus;
  purchase_price: number | null;
  purchase_date: string | null;
  arv_estimate: number | null;
  current_value_estimate: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  year_built: number | null;
  notes: string | null;
}

export interface Deal {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  source: string | null;
  asking_price: number | null;
  offer_price: number | null;
  arv_estimate: number | null;
  estimated_reno_cost: number | null;
  estimated_monthly_rent: number | null;
  stage: DealStage;
  target_close_date: string | null;
}
