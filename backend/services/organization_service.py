"""Organization service for aggregating domain statistics"""
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_
from typing import List, Dict, Tuple, Set
from datetime import datetime
from collections import defaultdict
from urllib.parse import urlparse

from backend.config import settings
from backend.models.credential import Credential
from backend.utils.domain_utils import (
    normalize_domain,
    extract_root_domain as util_extract_root_domain,
    best_domain_from,
)


def _is_ip_like(value: str) -> bool:
    """
    Return True if value looks like an IP-ish domain (e.g., '166.60', '10.6.3.134').
    Any label that's purely digits implies an IP-like subject; treat as 'other'.
    """
    if not value:
        return False
    parts = value.split(".")
    if len(parts) < 2:
        return False
    # All-numeric labels or mostly numeric labels = IP-like
    numeric_labels = sum(1 for p in parts if p.isdigit())
    return numeric_labels >= len(parts) - 0  # if every label is numeric or mostly numeric


def _sanitize_subdomain(raw: str) -> str:
    """
    Sanitize a noisy subdomain string (heuristic, non-strict):
      - Lowercase/strip
      - If URL-like, extract hostname
      - Strip path after '/' and tokens after ':' (ports or appended noise like ':loginhttps:')
      - Remove 'www.' prefix
      - Require at least one dot and non-numeric labels; otherwise return 'other'
    """
    s = str(raw or "").strip().lower()
    if not s:
        return "other"

    # If URL-like, get hostname
    if "://" in s:
        try:
            s = (urlparse(s).hostname or s)
        except Exception:
            pass

    # Strip path
    if "/" in s:
        s = s.split("/", 1)[0]

    # Strip everything after first ':' (ports or colon-chained noise)
    if ":" in s:
        s = s.split(":", 1)[0]

    # Strip www.
    if s.startswith("www."):
        s = s[4:]

    # Heuristic validity: must have at least one dot and at least one non-numeric label
    if "." not in s:
        return "other"
    parts = s.split(".")
    if all(p.isdigit() for p in parts):
        return "other"

    return s


class OrganizationService:
    """Service for organization-level analytics"""

    @staticmethod
    def extract_root_domain(domain: str) -> str:
        """Delegate to robust utility extract_root_domain with normalization rules."""
        return util_extract_root_domain(domain)

    @staticmethod
    def get_all_organizations(db: Session) -> List[Dict]:
        """
        Get all organizations with aggregated statistics.
        Deterministic root segmentation and subdomain sanitization:
          - Prefer raw Credential.domain for subdomain/root
          - Fallback to URL hostname when domain missing
          - Fallback to email domain from username when needed
          - Sanitize subdomain by stripping ports/protocol/login/email tokens
          - Move IP-like roots to 'other'
        """
        rows = db.query(
            Credential.domain,
            Credential.url,
            Credential.username,
            Credential.is_admin,
            Credential.first_seen,
            Credential.last_seen,
            Credential.seen_count,
        ).all()

        def simple_root_from(raw: str) -> str:
            """
            Derive root directly from the raw domain string using a deterministic heuristic,
            avoiding strict normalize_domain() so valid subdomains are not misclassified.
            - Strip path and port tokens
            - Remove www.
            - Use last 3 labels for common SLDs (co.id, go.id, etc.), else last 2 labels
            - Move IP-like roots to 'other'
            """
            s = str(raw or "").strip().lower()
            if not s:
                return "other"
            # strip path/port tokens
            if "/" in s:
                s = s.split("/", 1)[0]
            if ":" in s:
                s = s.split(":", 1)[0]
            if s.startswith("www."):
                s = s[4:]
            parts = s.split(".")
            if len(parts) >= 3 and parts[-2] in ["co", "go", "ac", "or", "web", "my", "sch", "gov", "com", "net", "edu"]:
                root = ".".join(parts[-3:])
            elif len(parts) >= 2:
                root = ".".join(parts[-2:])
            else:
                root = "other"
            if _is_ip_like(root):
                return "other"
            return root

        org_data: Dict[str, Dict] = defaultdict(
            lambda: {
                "subdomains": set(),  # Set[str] sanitized display names
                "total_credentials": 0,
                "admin_count": 0,
                "first_discovered": None,
                "last_seen": None,
            }
        )

        noisy_samples: List[Tuple[str, str, str]] = []
        sanitized_samples: List[Tuple[str, str]] = []

        for d, u, uname, is_admin, first_seen, last_seen, seen_count in rows:
            # Choose best raw subdomain candidate (before sanitizing)
            best_raw = d if d else None
            if not best_raw and u:
                try:
                    host = (urlparse(str(u)).hostname or "").lower()
                    best_raw = host or None
                except Exception:
                    best_raw = None
            if not best_raw and uname and "@" in str(uname):
                best_raw = str(uname).split("@", 1)[1].lower()

            # Sanitize to clean subdomain display
            sub_sanitized = _sanitize_subdomain(best_raw or "")
            if sub_sanitized == "other":
                noisy_samples.append((str(d), str(u), str(uname)))

            sanitized_samples.append((str(best_raw or ""), sub_sanitized))

            # Derive root deterministically
            root = simple_root_from(best_raw or "")
            if root == "other" and sub_sanitized != "other":
                # Try derive root from sanitized sub
                root = util_extract_root_domain(sub_sanitized)
                if _is_ip_like(root):
                    root = "other"

            data = org_data[root]
            data["subdomains"].add(sub_sanitized)
            data["total_credentials"] += 1
            if is_admin:
                data["admin_count"] += 1
            if first_seen:
                data["first_discovered"] = (
                    first_seen
                    if data["first_discovered"] is None
                    else min(data["first_discovered"], first_seen)
                )
            if last_seen:
                data["last_seen"] = (
                    last_seen
                    if data["last_seen"] is None
                    else max(data["last_seen"], last_seen)
                )

        # Diagnostics (DEBUG only)
        if settings.DEBUG:
            if noisy_samples:
                print(
                    f"[OrganizationService] Noisy raw entries grouped under 'other': {len(noisy_samples)} "
                    f"Samples: {noisy_samples[:5]}"
                )
            if sanitized_samples:
                sample_map = [
                    f"{orig} -> {san}"
                    for (orig, san) in sanitized_samples[:15]
                ]
                print("[OrganizationService] Subdomain sanitization samples:")
                for line in sample_map:
                    print("  -", line)

        # Build organizations result
        organizations: List[Dict] = []
        for root, data in org_data.items():
            subs_sorted = sorted(list(data["subdomains"]))
            # Count real subdomains; if only 'other' present, count it as 1
            sub_count = len([s for s in subs_sorted if s != "other"])
            if sub_count == 0 and "other" in subs_sorted:
                sub_count = 1
            organizations.append(
                {
                    "domain": root,
                    "total_credentials": data["total_credentials"],
                    "admin_count": data["admin_count"],
                    "subdomains": subs_sorted,
                    "subdomain_count": sub_count,
                    "first_discovered": data["first_discovered"] or datetime.now(),
                    "last_seen": data["last_seen"] or datetime.now(),
                }
            )

        # Sort valid orgs first, place 'other' last
        non_other = [e for e in organizations if e["domain"] != "other"]
        other = [e for e in organizations if e["domain"] == "other"]
        non_other.sort(key=lambda x: x["total_credentials"], reverse=True)
        return non_other + other

    @staticmethod
    def get_organization_detail(db: Session, domain: str) -> Dict:
        """
        Get detailed information for a specific organization.
        Deterministic: derive target root from provided string, use suffix-based filter:
          SELECT rows WHERE domain = root OR domain LIKE '%.root'
        Then sanitize subdomains and aggregate.
        """
        # Derive target root from provided domain string (fallback-friendly)
        raw_in = str(domain or "").strip().lower()
        if raw_in:
            s = raw_in
            if "/" in s:
                s = s.split("/", 1)[0]
            if ":" in s:
                s = s.split(":", 1)[0]
            if s.startswith("www."):
                s = s[4:]
            parts = s.split(".")
            if len(parts) >= 3 and parts[-2] in ["co", "go", "ac", "or", "web", "my", "sch", "gov", "com", "net", "edu"]:
                target_root = ".".join(parts[-3:])
            elif len(parts) >= 2:
                target_root = ".".join(parts[-2:])
            else:
                target_root = "other"
        else:
            target_root = "other"

        if _is_ip_like(target_root):
            target_root = "other"

        # Pull rows for this organization by suffix match (exact root or *.root)
        rows = db.query(
            Credential.id,
            Credential.domain,
            Credential.username,
            Credential.is_admin,
            Credential.first_seen,
            Credential.last_seen,
            Credential.created_at
        ).filter(
            or_(
                Credential.domain == target_root,
                Credential.domain.ilike(f"%.{target_root}")
            )
        ).all()

        # Debug: show matched row count and sample domains for this root
        if settings.DEBUG:
            try:
                sample = [str(r[1]) for r in rows[:15]]  # r[1] = Credential.domain
                print(f"[OrganizationService] detail '{target_root}': matched_rows={len(rows)} sample={sample}")
            except Exception:
                pass

        if not rows:
            return None

        # Group raw domains by sanitized display subdomain
        grouping: Dict[str, Set[str]] = defaultdict(set)
        total_credentials = 0
        total_admin = 0
        first_discovered = None
        last_seen = None

        for _id, raw_domain, username, is_admin, first_seen, last_seen_row, _created_at in rows:
            sub_sanitized = _sanitize_subdomain(raw_domain)
            if target_root != "other" and sub_sanitized == "other":
                # Skip noise when a valid root is requested
                continue
            grouping[sub_sanitized].add(raw_domain)

            total_credentials += 1
            if is_admin:
                total_admin += 1

            if first_seen:
                first_discovered = first_seen if first_discovered is None else min(first_discovered, first_seen)
            if last_seen_row:
                last_seen = last_seen_row if last_seen is None else max(last_seen, last_seen_row)

        if not grouping:
            return None

        # Aggregate stats per sanitized subdomain via SQL for accuracy
        subdomain_stats = []
        for disp_name, raw_group in grouping.items():
            stats = db.query(
                func.count(Credential.id).label("total"),
                func.sum(case((Credential.is_admin == True, 1), else_=0)).label("admin_count"),
            ).filter(
                Credential.domain.in_(list(raw_group))
            ).first()

            subdomain_stats.append({
                "subdomain": disp_name,
                "credential_count": int(stats.total or 0),
                "admin_count": int(stats.admin_count or 0),
            })

        # Sort subdomain stats by count
        subdomain_stats.sort(key=lambda x: x["credential_count"], reverse=True)

        # Recent credentials across sanitized subdomains
        raw_for_root = sorted({raw for _disp, raws in grouping.items() for raw in raws})
        recent_creds_rows = db.query(
            Credential.id,
            Credential.username,
            Credential.domain,
            Credential.is_admin,
            Credential.created_at
        ).filter(
            Credential.domain.in_(raw_for_root)
        ).order_by(
            Credential.created_at.desc()
        ).limit(10).all()

        recent_credentials = [
            {
                "id": cred_id,
                "email": uname,
                "subdomain": _sanitize_subdomain(dom),
                "is_admin": is_admin,
                "discovered_at": created_at,
            }
            for (cred_id, uname, dom, is_admin, created_at) in recent_creds_rows
        ]

        display_subs = sorted(grouping.keys())
        # Diagnostics: summary for consistency checks across views
        # Diagnostics: summary for consistency checks across views
        if settings.DEBUG:
            try:
                print(f"[OrganizationService] detail summary domain={target_root} "
                      f"total_credentials={total_credentials} admin_count={total_admin} "
                      f"display_subdomains={len(display_subs)}")
            except Exception:
                pass
        return {
            "domain": target_root,
            "total_credentials": total_credentials,
            "admin_count": total_admin,
            "subdomains": display_subs,
            "subdomain_count": len([s for s in display_subs if s != "other"]) or (1 if "other" in display_subs else 0),
            "first_discovered": first_discovered or datetime.now(),
            "last_seen": last_seen or datetime.now(),
            "subdomain_stats": subdomain_stats,
            "recent_credentials": recent_credentials,
        }