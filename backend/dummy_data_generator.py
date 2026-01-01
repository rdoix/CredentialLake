#!/usr/bin/env python3
"""
Dummy Data Generator for IntelX Scanner
Generates 100k-120k unique credentials with realistic patterns for testing and demo purposes
"""
import random
import string
import hashlib
import time
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import json


class DummyDataGenerator:
    """Generate realistic dummy credentials for testing"""
    
    def __init__(self, seed: int = None):
        """Initialize generator with seed for reproducibility"""
        # Use time-based seed for more randomness if not specified
        if seed is None:
            seed = int(time.time() * 1000) % 1000000
        random.seed(seed)
        self.seed = seed
        
        # Indonesian domains (popular .id domains)
        self.id_domains = [
            'go.id', 'co.id', 'ac.id', 'or.id', 'web.id', 'sch.id',
            'net.id', 'my.id', 'biz.id', 'desa.id'
        ]
        
        # Popular international domains
        self.intl_domains = [
            'com', 'net', 'org', 'io', 'dev', 'app', 'cloud',
            'tech', 'digital', 'online', 'site', 'xyz'
        ]
        
        # Company/organization names
        self.company_names = [
            'acme', 'techcorp', 'globaltech', 'innovate', 'nexus',
            'quantum', 'digital', 'cyber', 'cloud', 'data',
            'smart', 'future', 'mega', 'ultra', 'prime',
            'alpha', 'beta', 'gamma', 'delta', 'omega',
            'phoenix', 'titan', 'atlas', 'zenith', 'apex',
            'vertex', 'matrix', 'vector', 'pixel', 'vortex',
            'synergy', 'fusion', 'catalyst', 'momentum', 'velocity',
            'horizon', 'summit', 'pinnacle', 'crest', 'peak'
        ]
        
        # Indonesian-themed fictional company names (generic, non-real)
        self.id_company_names = [
            'nusatech', 'garudatech', 'mandalasoft', 'bioniclab', 'auroradata',
            'satrianet', 'merahputih', 'jalak', 'kencanacloud', 'serunai',
            'sundev', 'zenidata', 'arkatech', 'purnama', 'samudra',
            'kilau', 'nexusid', 'astralab', 'lontar', 'banyutech'
        ]
        
        # Subdomains
        self.subdomains = [
            'www', 'mail', 'webmail', 'portal', 'admin',
            'dashboard', 'app', 'api', 'dev', 'staging',
            'test', 'demo', 'beta', 'secure', 'login',
            'auth', 'sso', 'vpn', 'remote', 'cloud',
            'crm', 'erp', 'hr', 'finance', 'sales',
            'support', 'help', 'docs', 'wiki', 'blog'
        ]
        
        # Common usernames
        self.username_patterns = [
            'admin', 'administrator', 'root', 'user', 'test',
            'demo', 'guest', 'support', 'info', 'contact',
            'sales', 'marketing', 'hr', 'finance', 'it',
            'webmaster', 'postmaster', 'hostmaster', 'manager', 'director'
        ]
        
        # First names
        self.first_names = [
            'john', 'jane', 'michael', 'sarah', 'david',
            'emily', 'james', 'lisa', 'robert', 'maria',
            'william', 'jennifer', 'richard', 'linda', 'thomas',
            'budi', 'siti', 'ahmad', 'dewi', 'agus',
            'sri', 'eko', 'rini', 'hadi', 'wati',
            'andi', 'yuni', 'dedi', 'lina', 'bambang'
        ]
        
        # Last names
        self.last_names = [
            'smith', 'johnson', 'williams', 'brown', 'jones',
            'garcia', 'miller', 'davis', 'rodriguez', 'martinez',
            'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
            'susanto', 'wijaya', 'kurniawan', 'santoso', 'pratama',
            'putra', 'saputra', 'wibowo', 'setiawan', 'hidayat',
            'rahman', 'hakim', 'nugroho', 'permana', 'gunawan'
        ]
        
        # Password patterns (common weak passwords)
        self.password_bases = [
            'password', 'admin', '123456', 'qwerty', 'letmein',
            'welcome', 'monkey', 'dragon', 'master', 'sunshine',
            'princess', 'football', 'shadow', 'superman', 'batman',
            'trustno1', 'passw0rd', 'abc123', 'password1', 'admin123'
        ]
        
        # Years for password suffixes
        self.years = ['2020', '2021', '2022', '2023', '2024', '2025']
        
        # Special chars for passwords
        self.special_chars = ['!', '@', '#', '$', '%', '&', '*']
        
        # Domain weights for more varied distribution
        # Some domains will appear more frequently than others
        self.domain_weights = {}
        self._initialize_domain_weights()
    
    def _initialize_domain_weights(self):
        """Initialize weighted domain selection for more natural distribution"""
        # Create weighted probabilities for domains
        # Some domains will have many more credentials than others
        all_companies = self.company_names + self.id_company_names
        
        for company in all_companies:
            # Random weight between 0.1 and 5.0 for varied distribution
            self.domain_weights[company] = random.uniform(0.1, 5.0)
    
    def _generate_domain(self, use_indonesian: bool = False) -> str:
        """Generate a realistic domain with weighted selection"""
        if use_indonesian:
            # Weighted selection for Indonesian companies
            companies = self.id_company_names
            weights = [self.domain_weights.get(c, 1.0) for c in companies]
            company = random.choices(companies, weights=weights, k=1)[0]
            tld = random.choice(self.id_domains)
        else:
            # Weighted selection for international companies
            companies = self.company_names
            weights = [self.domain_weights.get(c, 1.0) for c in companies]
            company = random.choices(companies, weights=weights, k=1)[0]
            tld = random.choice(self.intl_domains)
        
        # Sometimes add subdomain (40% chance for more variety)
        if random.random() < 0.4:
            subdomain = random.choice(self.subdomains)
            return f"{subdomain}.{company}.{tld}"
        
        return f"{company}.{tld}"
    
    def _generate_url(self, domain: str) -> str:
        """Generate URL from domain"""
        protocol = random.choice(['https', 'http'])
        
        # Sometimes add path
        paths = ['', '/login', '/admin', '/portal', '/dashboard', '/auth', '/api']
        path = random.choice(paths)
        
        return f"{protocol}://{domain}{path}"
    
    def _generate_username(self, domain: str) -> str:
        """Generate realistic username"""
        patterns = [
            # Email format
            lambda: f"{random.choice(self.first_names)}.{random.choice(self.last_names)}@{domain}",
            lambda: f"{random.choice(self.first_names)}{random.randint(1, 999)}@{domain}",
            lambda: f"{random.choice(self.username_patterns)}@{domain}",
            # Simple username
            lambda: random.choice(self.username_patterns),
            lambda: f"{random.choice(self.first_names)}.{random.choice(self.last_names)}",
            lambda: f"{random.choice(self.first_names)}{random.randint(1, 999)}",
        ]
        
        return random.choice(patterns)()
    
    def _generate_password(self) -> str:
        """Generate realistic weak password"""
        patterns = [
            # Base password
            lambda: random.choice(self.password_bases),
            # Base + year
            lambda: f"{random.choice(self.password_bases)}{random.choice(self.years)}",
            # Base + special
            lambda: f"{random.choice(self.password_bases)}{random.choice(self.special_chars)}",
            # Base + number
            lambda: f"{random.choice(self.password_bases)}{random.randint(1, 999)}",
            # Base + year + special
            lambda: f"{random.choice(self.password_bases)}{random.choice(self.years)}{random.choice(self.special_chars)}",
            # Simple patterns
            lambda: f"{''.join(random.choices(string.ascii_lowercase, k=8))}",
            lambda: f"{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}",
        ]
        
        return random.choice(patterns)()
    
    def _is_admin_credential(self, username: str, domain: str) -> bool:
        """Determine if credential should be marked as admin"""
        admin_keywords = ['admin', 'administrator', 'root', 'superuser', 'sysadmin']
        username_lower = username.lower()
        domain_lower = domain.lower()
        
        return any(keyword in username_lower or keyword in domain_lower for keyword in admin_keywords)
    
    def _generate_timestamp(self, days_back: int = 365) -> datetime:
        """Generate random timestamp within last N days"""
        now = datetime.utcnow()
        random_days = random.randint(0, days_back)
        random_hours = random.randint(0, 23)
        random_minutes = random.randint(0, 59)
        
        return now - timedelta(days=random_days, hours=random_hours, minutes=random_minutes)
    
    def generate_credential(self, index: int, total: int) -> Dict:
        """Generate a single unique credential"""
        # Determine if Indonesian domain (30% chance)
        use_indonesian = random.random() < 0.3
        
        # Generate domain and URL
        domain = self._generate_domain(use_indonesian)
        url = self._generate_url(domain)
        
        # Generate username and password
        username = self._generate_username(domain)
        password = self._generate_password()
        
        # Ensure uniqueness by adding index if needed
        unique_suffix = f"{index:06d}"
        
        # Make credential unique by hashing combination
        unique_hash = hashlib.md5(f"{url}{username}{password}{unique_suffix}".encode()).hexdigest()[:8]
        
        # Sometimes append unique hash to ensure 200k unique entries
        if random.random() < 0.1:
            password = f"{password}_{unique_hash}"
        
        # Determine admin status
        is_admin = self._is_admin_credential(username, domain)
        
        # Generate timestamps
        first_seen = self._generate_timestamp(365)
        last_seen = first_seen + timedelta(days=random.randint(0, 30))
        seen_count = random.randint(1, 10)
        
        return {
            'url': url,
            'username': username,
            'password': password,
            'domain': domain,
            'is_admin': is_admin,
            'first_seen': first_seen.isoformat(),
            'last_seen': last_seen.isoformat(),
            'seen_count': seen_count
        }
    
    def generate_batch(self, count: int = None) -> List[Dict]:
        """Generate batch of unique credentials with random count in 100k-120k range"""
        # Generate random count in range if not specified
        if count is None:
            count = random.randint(100000, 120000)
        
        print(f"Generating {count:,} unique credentials (seed: {self.seed})...")
        
        credentials = []
        seen_combinations = set()
        
        for i in range(count):
            if i % 10000 == 0 and i > 0:
                print(f"  Generated {i:,} / {count:,} credentials ({i/count*100:.1f}%)")
            
            # Generate credential
            cred = self.generate_credential(i, count)
            
            # Ensure uniqueness
            combo_key = f"{cred['url']}|{cred['username']}|{cred['password']}"
            
            # If duplicate, regenerate with different seed
            attempts = 0
            while combo_key in seen_combinations and attempts < 10:
                cred = self.generate_credential(i + random.randint(1000, 9999), count)
                combo_key = f"{cred['url']}|{cred['username']}|{cred['password']}"
                attempts += 1
            
            seen_combinations.add(combo_key)
            credentials.append(cred)
        
        print(f"✅ Generated {len(credentials):,} unique credentials")
        print(f"   Unique combinations: {len(seen_combinations):,}")
        
        return credentials
    
    def save_to_json(self, credentials: List[Dict], filename: str = 'dummy_credentials.json'):
        """Save credentials to JSON file"""
        print(f"\nSaving to {filename}...")
        
        with open(filename, 'w') as f:
            json.dump(credentials, f, indent=2)
        
        print(f"✅ Saved {len(credentials):,} credentials to {filename}")
    
    def generate_statistics(self, credentials: List[Dict]) -> Dict:
        """Generate statistics about the dummy data"""
        total = len(credentials)
        admin_count = sum(1 for c in credentials if c['is_admin'])
        
        # Count domains
        domains = {}
        for c in credentials:
            domain = c['domain']
            domains[domain] = domains.get(domain, 0) + 1
        
        # Count TLDs
        tlds = {}
        for domain in domains.keys():
            tld = domain.split('.')[-1]
            tlds[tld] = tlds.get(tld, 0) + 1
        
        stats = {
            'total_credentials': total,
            'admin_credentials': admin_count,
            'admin_percentage': round(admin_count / total * 100, 2),
            'unique_domains': len(domains),
            'unique_tlds': len(tlds),
            'top_10_domains': sorted(domains.items(), key=lambda x: x[1], reverse=True)[:10],
            'tld_distribution': dict(sorted(tlds.items(), key=lambda x: x[1], reverse=True))
        }
        
        return stats


def main():
    """Main function to generate dummy data"""
    print("=" * 80)
    print("IntelX Scanner - Dummy Data Generator")
    print("=" * 80)
    print()
    
    # Initialize generator with time-based seed for uniqueness
    generator = DummyDataGenerator(seed=None)
    
    # Generate credentials with random count in 100k-120k range
    credentials = generator.generate_batch(count=None)
    
    # Generate statistics
    print("\n" + "=" * 80)
    print("Statistics")
    print("=" * 80)
    stats = generator.generate_statistics(credentials)
    
    print(f"Total Credentials: {stats['total_credentials']:,}")
    print(f"Admin Credentials: {stats['admin_credentials']:,} ({stats['admin_percentage']}%)")
    print(f"Unique Domains: {stats['unique_domains']:,}")
    print(f"Unique TLDs: {stats['unique_tlds']}")
    print()
    print("Top 10 Domains:")
    for domain, count in stats['top_10_domains']:
        print(f"  {domain}: {count:,} credentials")
    print()
    print("TLD Distribution:")
    for tld, count in list(stats['tld_distribution'].items())[:10]:
        print(f"  .{tld}: {count:,} credentials")
    
    # Save to file
    print("\n" + "=" * 80)
    generator.save_to_json(credentials, 'dummy_credentials.json')
    
    # Also save statistics
    with open('dummy_credentials_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"✅ Saved statistics to dummy_credentials_stats.json")
    
    print("\n" + "=" * 80)
    print("✅ Dummy data generation complete!")
    print("=" * 80)
    print()
    print("Next steps:")
    print("1. Import dummy data: python backend/cli.py --import-dummy dummy_credentials.json")
    print("2. Start the application and login with your admin credentials")
    print()


if __name__ == '__main__':
    main()