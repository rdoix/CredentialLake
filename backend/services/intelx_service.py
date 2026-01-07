"""IntelX service wrapping existing intelx_client module"""
import sys
import os
from typing import List, Dict, Optional, Callable
import logging

logger = logging.getLogger(__name__)

# Import from backend directory
from backend.intelx_client import search_leaks, process_search_results, process_multiple_domains
from backend.config import settings
# Prefer 'intelx' package, fall back to 'intelxapi' if available
try:
    from intelx import IntelX as _IntelXClass
except ImportError:
    _IntelXClass = None
try:
    from intelxapi import intelx as _IntelXApiClass
except ImportError:
    _IntelXApiClass = None


class IntelXService:
    """Service for IntelX API operations"""

    def _sanitize_api_key(self, key: str) -> str:
        """
        Normalize API key to avoid invalid HTTP header values.
        - Strip leading/trailing whitespace, tabs, newlines
        - Remove control characters (< ' ' and DEL)
        - Remove surrounding quotes
        """
        if not isinstance(key, str):
            return ""
        s = key.strip()  # trims spaces, \t, \r, \n
        # Remove control characters
        s = "".join(ch for ch in s if ch >= " " and ch != "\x7f")
        # Remove common accidental wrapping quotes
        s = s.strip("'\"")
        return s

    def __init__(self, api_key: str):
        """Initialize IntelX client (with API key sanitization)"""
        original_key = api_key or ""
        key = self._sanitize_api_key(original_key)

        if not key:
            raise ValueError("IntelX API key is empty or invalid after sanitization")

        if key != original_key:
            try:
                logger.warning(f"IntelXService: sanitized API key; original_len={len(original_key)} sanitized_len={len(key)}")
            except Exception:
                pass

        self.api_key = key

        if _IntelXClass is not None:
            # Use the 'intelx' package (preferred)
            self.ix = _IntelXClass(key)
        elif _IntelXApiClass is not None:
            # Fallback to legacy 'intelxapi' package
            self.ix = _IntelXApiClass(key)
        else:
            raise ImportError("No IntelX client library found. Install 'intelx' or 'intelxapi'.")
    
    def search_single_domain(
        self,
        query: str,
        max_results: int = 100,
        time_filter: Optional[str] = None,
        limit: int = 10,
        should_stop: Optional[Callable[[str], None]] = None
    ) -> List[Dict]:
        """
        Search for a single domain/email.
        Returns list of credential dicts with 'line', 'important', 'file_name', 'file_idx'
        Supports cooperative cancellation via should_stop('collecting').
        """
        search_result = search_leaks(self.ix, query, max_results, time_filter, should_stop=should_stop)
        if not search_result:
            return []
        
        # Rely on search_leaks attaching datefrom/dateto to search_result for client-side filtering
        credentials = process_search_results(self.ix, search_result, query, limit, should_stop=should_stop)
        return credentials
    
    def search_multiple_domains(
        self,
        domains: List[str],
        max_results: int = 100,
        time_filter: Optional[str] = None,
        limit: int = 10,
        max_workers: Optional[int] = None,
        delay_secs: Optional[float] = None,
        should_stop: Optional[Callable[[str], None]] = None
    ) -> tuple[List[Dict], List[str]]:
        """
        Search for multiple domains with PARALLEL processing.
        Returns (credentials, domains_with_results)
        Supports cooperative cancellation via should_stop('collecting').
        
        Args:
            domains: List of domains to scan
            max_results: Maximum results per domain
            time_filter: Time filter for search
            limit: Display limit per domain
            max_workers: Number of parallel workers (default from settings)
            delay_secs: Delay between requests (default from settings)
        """
        # Use settings defaults if not provided
        if max_workers is None:
            max_workers = settings.PARALLEL_DOMAIN_WORKERS
        if delay_secs is None:
            delay_secs = settings.DOMAIN_SCAN_DELAY
        
        credentials, domains_found = process_multiple_domains(
            self.ix,
            domains,
            time_filter=time_filter,
            maxresults=max_results,
            limit=limit,
            delay_secs=delay_secs,
            max_workers=max_workers,
            should_stop=should_stop
        )
        return credentials, domains_found