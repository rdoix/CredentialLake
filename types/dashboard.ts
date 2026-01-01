export interface DashboardStats {
  totalCredentials: number;
  totalAdminFound: number;
  topDomains: DomainStat[];
  topPasswords: PasswordStat[];
  topTlds: TldStat[];
  timeline: TimelineData[];
}

export interface DomainStat {
  domain: string;
  count: number;
  adminCount: number;
}

export interface PasswordStat {
  text: string;
  value: number;
}

export interface TldStat {
  tld: string;
  count: number;
  percentage: number;
}

export interface TimelineData {
  date: string;
  credentials: number;
  parsed: number;
  failed: number;
}
