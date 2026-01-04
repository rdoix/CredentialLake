"""Organization routes for aggregated domain statistics"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from backend.database import get_db
from backend.services.organization_service import OrganizationService
from backend.models.schemas import OrganizationStats, OrganizationDetail
from backend.models.credential import Credential
from backend.models.scan_job import JobCredential
from backend.routes.auth import get_current_user, require_collector_or_admin
from backend.models.user import User

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.get("", response_model=List[OrganizationStats])
def get_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all organizations with aggregated statistics.
    Organizations are grouped by root domain.
    """
    organizations = OrganizationService.get_all_organizations(db)
    return organizations


@router.get("/{domain}", response_model=OrganizationDetail)
def get_organization_detail(
    domain: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information for a specific organization.
    Includes subdomain breakdown and recent credentials.
    """
    detail = OrganizationService.get_organization_detail(db, domain)
    
    if not detail:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return detail


@router.delete("/{domain}")
def delete_organization(
    domain: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """
    Delete an organization and all its credentials recursively.
    This will delete all credentials where the domain matches the organization root.
    """
    # Normalize domain for matching
    target_domain = domain.strip().lower()
    
    # Find all credentials matching this organization (exact match or subdomain)
    credentials_query = db.query(Credential).filter(
        or_(
            Credential.domain == target_domain,
            Credential.domain.ilike(f"%.{target_domain}"),
            Credential.domain.ilike(f"%{target_domain}%")
        )
    )
    
    # Get credential IDs for job association cleanup
    credential_ids = [c.id for c in credentials_query.all()]
    
    if not credential_ids:
        raise HTTPException(status_code=404, detail=f"No credentials found for organization '{domain}'")
    
    # Delete job associations first (FK constraint)
    assoc_deleted = db.query(JobCredential).filter(
        JobCredential.credential_id.in_(credential_ids)
    ).delete(synchronize_session=False)
    
    # Delete credentials
    creds_deleted = credentials_query.delete(synchronize_session=False)
    
    db.commit()
    
    print(f"[organizations.delete_organization] Deleted organization '{domain}': {creds_deleted} credentials, {assoc_deleted} job associations")
    
    return {
        "message": f"Successfully deleted organization '{domain}'",
        "domain": domain,
        "credentials_deleted": creds_deleted,
        "associations_deleted": assoc_deleted
    }