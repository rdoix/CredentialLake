"""Domain normalization utilities"""

import re
from urllib.parse import urlparse


PUBLIC_SUFFIX_MULTI = {
    # Indonesia
    "co.id", "go.id", "ac.id", "or.id", "web.id", "my.id", "sch.id",
    # UK
    "co.uk", "gov.uk", "ac.uk", "org.uk",
    # Australia
    "com.au", "net.au", "gov.au",
    # Japan
    "co.jp",
}

# Pure TLDs that should NOT be treated as valid root domains
# These are actual TLDs, not organizational domains
# NOTE: User requirement: 'desa.id' and 'biz.id' MUST be allowed as root domains.
INVALID_ROOT_DOMAINS = {
    # Indonesian category that should be excluded as a pure TLD
    "net.id", "id",
    # Common top-levels (single label) for safety
    "com", "net", "org", "edu", "gov", "mil",
    "co", "uk", "au", "jp", "de", "fr", "it", "es",
}

# Exact multi-label suffixes that are allowed as organizational roots when they appear alone
# per user feedback (e.g., desa.id and biz.id should be valid roots in Top Domains)
ALLOW_EXACT_ROOTS = {
    "desa.id",
    "biz.id",
}


def normalize_domain(value: str) -> str:
    """
    Normalize a potentially noisy domain string into a clean domain.
    Rules:
      - Lowercase, strip whitespace.
      - Remove protocol (http/https/ftp) and paths.
      - Remove ports and colon-delimited noise tokens (e.g., ':8080', ':Loginhttps:').
      - Remove 'www.' prefix.
      - Validate against a domain regex; return 'other' if invalid.

    Examples:
      'acmecorp.com:8080' -> 'acmecorp.com'
      'acmecorp.com:Loginhttps:' -> 'acmecorp.com'
      'https' -> 'other'
      'http://mail.acmecorp.com/login' -> 'mail.acmecorp.com'
    """
    s = (value or "").strip().lower()
    if not s:
        return "other"

    # If looks like a URL, parse it
    if "://" in s:
        try:
            parsed = urlparse(s)
            s = parsed.netloc or parsed.path or s
        except Exception:
            # fall through to non-URL handling
            pass

    # Strip path if present
    if "/" in s:
        s = s.split("/", 1)[0]

    # Strip everything after first ':' (port or noise)
    if ":" in s:
        s = s.split(":", 1)[0]

    # Strip common protocol words left as tokens
    if s in {"http", "https"}:
        return "other"

    # Strip www.
    if s.startswith("www."):
        s = s[4:]

    # Validate domain structure
    # label: alphanum or '-', not starting/ending with '-'
    label = r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)"
    # NOTE: In an f-string, curly braces are format placeholders. To express a regex
    # quantifier like {2,24}, we must escape them as double braces '{{2,24}}'
    # otherwise Python formats the tuple (2, 24) and the pattern stops matching domains.
    domain_re = re.compile(rf"^(?:{label}\.)+[a-z]{{2,24}}$")
    if not domain_re.match(s):
        # Fallback: try to salvage a domain-like token from the cleaned string or original value
        def find_candidate(text: str) -> str:
            matches = re.findall(r"(?:[a-z0-9-]+\.)+[a-z]{2,24}", text)
            if not matches:
                return ""
            # Prefer longest match
            cand = max(matches, key=len)
            if cand.startswith("www."):
                cand = cand[4:]
            return cand

        cand = find_candidate(s)
        if not cand and value:
            cand = find_candidate((value or "").strip().lower())

        if cand and domain_re.match(cand):
            return cand

        return "other"
    
    return s


def extract_root_domain(domain: str) -> str:
    """
    Extract root domain based on common multi-label public suffixes.
    Returns 'other' if normalization fails or if the result is a pure TLD.

    For multi-label suffixes (e.g., 'co.id'), root = last N+1 labels (domain + suffix).
    Otherwise, root = last 2 labels.
    
    Filters out pure TLDs like 'net.id', 'desa.id', 'biz.id' which are not valid root domains.
    """
    norm = normalize_domain(domain)
    if norm == "other":
        return "other"

    # Allow exact multi-label roots explicitly requested by user
    if norm in ALLOW_EXACT_ROOTS:
        return norm

    parts = norm.split(".")
    suffix = ".".join(parts[-2:]) if len(parts) >= 2 else norm

    # Check multi-label public suffix endings
    for ps in PUBLIC_SUFFIX_MULTI:
        if norm.endswith("." + ps) or norm == ps:
            n = len(ps.split("."))
            if len(parts) <= n:
                # Exact multi-label suffix without preceding label (e.g., 'go.id')
                # If explicitly allowed, return as root; otherwise treat as TLD-only
                return norm if norm in ALLOW_EXACT_ROOTS else "other"
            root = ".".join(parts[-(n + 1):])
            # Check if the extracted root is actually a pure TLD
            if root in INVALID_ROOT_DOMAINS and root not in ALLOW_EXACT_ROOTS:
                return "other"
            return root

    # Default: last 2 labels
    if len(parts) >= 2:
        root = ".".join(parts[-2:])
        # Check if the extracted root is actually a pure TLD
        if root in INVALID_ROOT_DOMAINS and root not in ALLOW_EXACT_ROOTS:
            return "other"
        return root
    
    # Single label domain - treat as other
    return "other"


def best_domain_from(domain: str, url=None, username=None) -> str:
    """
    Choose the best normalized domain from record fields:
    - Prefer normalized domain
    - Fallback to normalized URL host/path
    - Fallback to email domain (username after '@')
    - Fallback to candidate extraction from any text
    Returns 'other' if none are valid.
    """
    # Domain regex
    label = r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)"
    domain_re = re.compile(rf"^(?:{label}\.)+[a-z]{2,24}$")

    # Helper: extract any domain-like candidate from text
    def find_candidate(text: str) -> str:
        if not text:
            return ""
        matches = re.findall(r"(?:[a-z0-9-]+\.)+[a-z]{2,24}", str(text).lower())
        if not matches:
            return ""
        cand = max(matches, key=len)
        if cand.startswith("www."):
            cand = cand[4:]
        return cand

    nd = normalize_domain(domain)
    if nd != "other" and domain_re.match(nd):
        return nd

    # URL fallback
    if url:
        nu = normalize_domain(url)
        if nu != "other" and domain_re.match(nu):
            return nu
        cand = find_candidate(url)
        if cand and domain_re.match(cand):
            return cand

    # Email fallback
    if username and "@" in str(username):
        email_dom = str(username).split("@", 1)[1]
        ne = normalize_domain(email_dom)
        if ne != "other" and domain_re.match(ne):
            return ne
        cand = find_candidate(email_dom)
        if cand and domain_re.match(cand):
            return cand

    # Last resort: any candidate from combined text
    combined = " ".join([str(domain or ""), str(url or ""), str(username or "")])
    cand = find_candidate(combined)
    if cand and domain_re.match(cand):
        return cand

    return "other"