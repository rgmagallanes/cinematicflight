/**
 * Phase 1 contract only. Implementations must not perform network or database work
 * inside the domain package. ManualProvider is the first planned adapter; paid
 * providers remain future adapters behind this boundary.
 */
export interface DiscoveryMissionInput {
  missionPublicId: string;
  objective: string;
  location: string;
  targetCategories: readonly string[];
  maximumCandidates: number;
}

export interface DiscoveryCandidate {
  businessName: string;
  category: string;
  address: string | null;
  location: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  externalSource: string;
  externalSourceId: string | null;
}

export interface DiscoveryProvider {
  readonly name: string;
  discover(input: DiscoveryMissionInput): Promise<readonly DiscoveryCandidate[]>;
}
