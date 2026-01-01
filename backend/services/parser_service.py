"""Parser service wrapping existing CredentialParser"""
import sys
import os
from typing import List, Dict

# Import from backend directory
from backend.scanner_engine import CredentialParser
from backend.config import settings


class ParserService:
    """Service for parsing credentials"""
    
    @staticmethod
    def parse_credentials(credential_lines: List[str], should_stop=None) -> List[Dict]:
        """
        Parse credential lines into structured format.
        Returns list of dicts with 'url', 'username', 'password', 'pattern_id'
        Supports cooperative cancellation via should_stop('parsing').
        """
        print(f"ParserService.parse_credentials: start lines={len(credential_lines)}")
        parser = CredentialParser()
        parsed_count = parser.parse_credentials_from_list(credential_lines, show_stats=False, should_stop=should_stop)
        print(f"ParserService.parse_credentials: parsed={parsed_count} unparsed={len(credential_lines) - parsed_count}")
        return parser.parsed_credentials
    
    @staticmethod
    def parse_raw_lines(raw_lines: List[str], should_stop=None) -> tuple[List[Dict], int, int]:
        """
        Parse raw credential lines and return parsed credentials with stats.
        Returns (parsed_credentials, parsed_count, unparsed_count)
        Supports cooperative cancellation via should_stop('parsing').
        """
        print(f"ParserService.parse_raw_lines: start total_lines={len(raw_lines)}")
        if settings.DEBUG:
            print(f"ParserService.parse_raw_lines: sample={raw_lines[:3] if raw_lines else []}")
        parser = CredentialParser()
        parsed_count = parser.parse_credentials_from_list(raw_lines, show_stats=False, should_stop=should_stop)
        unparsed_count = len(raw_lines) - parsed_count
        print(f"ParserService.parse_raw_lines: parsed={parsed_count} unparsed={unparsed_count}")
        
        return parser.parsed_credentials, parsed_count, unparsed_count