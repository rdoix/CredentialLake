export interface Organization {
  domain: string; // Root domain (e.g., acmecorp.com, techstart.io)
  totalCredentials: number;
  adminCount: number;
  subdomains: string[];
  subdomainCount: number;
  firstDiscovered: string;
  lastSeen: string;
}

export interface OrganizationDetail extends Organization {
  subdomainStats: {
    subdomain: string;
    credentialCount: number;
    adminCount: number;
  }[];
  recentCredentials: {
    id: string;
    email: string;
    subdomain: string;
    isAdmin: boolean;
    discoveredAt: string;
  }[];
}