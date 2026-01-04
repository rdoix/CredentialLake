export interface CVE {
  id: number;
  cve_id: string;
  title: string;
  description: string;
  is_rejected: boolean;
  published_date: string;
  last_modified_date: string;
  severity: string | null;
  cvss_v3_score: number | null;
  cvss_v3_vector: string | null;
  cvss_v2_score: number | null;
  cvss_v2_vector: string | null;
  cwe_id: string | null;
  references: string | null;
  affected_products: string | null;
  created_at: string;
  updated_at: string;
}

export interface CVEStats {
  total: number;
  recent_7days: number;
  by_severity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

export interface CVEListResponse {
  items: CVE[];
  total: number;
  limit: number;
  offset: number;
}

export interface CVEFilters {
  keyword?: string;
  year?: number;
  severity?: string;
  min_cvss?: number;
  max_cvss?: number;
}