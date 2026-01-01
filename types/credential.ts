export interface Credential {
  id: string;
  email: string;
  password: string;
  domain: string;
  source: string;
  breachDate: string;
  discoveredAt: string;
  passwordStrength: 'weak' | 'medium' | 'strong';
  isAdmin: boolean;
  verified: boolean;
  metadata?: {
    ipAddress?: string;
    location?: string;
    browser?: string;
  };
}

export interface CredentialFilters {
  search?: string;
  domain?: string;
  dateFrom?: string;
  dateTo?: string;
  passwordStrength?: ('weak' | 'medium' | 'strong')[];
  isAdmin?: boolean;
  verified?: boolean;
  source?: string;
}

export interface CredentialStats {
  total: number;
  verified: number;
  admin: number;
  weak: number;
  medium: number;
  strong: number;
}

export type SortField = 'email' | 'domain' | 'breachDate' | 'discoveredAt' | 'passwordStrength';
export type SortOrder = 'asc' | 'desc';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
