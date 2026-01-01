"""IntelX service wrapping existing intelx_client module"""
import sys
import os
from typing import List, Dict, Optional, Callable

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
    
    def __init__(self, api_key: str):
        """Initialize IntelX client"""
        self.api_key = api_key
        if _IntelXClass is not None:
            # Use the 'intelx' package (preferred)
            self.ix = _IntelXClass(api_key)
        elif _IntelXApiClass is not None:
            # Fallback to legacy 'intelxapi' package
            self.ix = _IntelXApiClass(api_key)
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