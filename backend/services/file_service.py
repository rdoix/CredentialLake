"""File service wrapping existing scanner_engine module"""
import sys
import os
from typing import List

# Import from backend directory
from backend.scanner_engine import process_file_mode


class FileService:
    """Service for file processing operations"""
    
    @staticmethod
    def process_file(file_path: str, query: str = None) -> List[str]:
        """
        Process a file and extract credential lines.
        Returns list of credential lines.
        """
        print(f"FileService.process_file: start file_path={file_path} query={query}")
        lines = process_file_mode(file_path, query)
        try:
            sample = lines[:3] if isinstance(lines, list) else []
        except Exception:
            sample = []
        print(f"FileService.process_file: extracted_lines={len(lines) if hasattr(lines, '__len__') else 'unknown'} sample={sample}")
        return lines