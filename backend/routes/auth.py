"""Authentication routes for login, register, and user management"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import jwt
import re
import logging
from datetime import datetime, timedelta
from backend.database import get_db
from backend.models.user import User
from backend.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Dummy import async state (simple in-memory tracker)
DUMMY_IMPORT_STATE = {
    "running": False,
    "progress": 0,        # percentage (0-100)
    "message": "",
    "error": None,
    "started_at": None,
    "completed": False,
    "statistics": None,
}

# JWT Configuration
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password policy
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_AGE_DAYS = 90

# Valid roles
VALID_ROLES = ["administrator", "collector", "user"]


# Pydantic models
class UserSetupAdmin(BaseModel):
    """Model for initial admin setup"""
    username: str
    email: EmailStr
    full_name: str
    password: str


class UserCreate(BaseModel):
    """Model for admin creating new users"""
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: str = "user"  # administrator, collector, or user
    password_expiry_days: Optional[int] = 90  # None = never expire, or number of days


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    password_expires_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserUpdate(BaseModel):
    """Model for updating user status"""
    is_active: Optional[bool] = None
    role: Optional[str] = None
    new_password: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password_expiry_days: Optional[int] = None  # None = never expire, or number of days


# Helper functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def validate_password_strength(password: str, username: str = "", email: str = ""):
    """Enforce strong password policy.
    Requirements:
      - Min length PASSWORD_MIN_LENGTH
      - At least one uppercase, one lowercase, one digit, one special char
      - Must not contain username or email local-part
    """
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"minimum length {PASSWORD_MIN_LENGTH}")
    if not re.search(r"[A-Z]", password):
        errors.append("at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("at least one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("at least one digit")
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?|\\`~]", password):
        errors.append("at least one special character")

    p_lower = password.lower()
    if username and username.lower() in p_lower:
        errors.append("password must not contain username")
    if email:
        local = email.split("@")[0].lower()
        if local and local in p_lower:
            errors.append("password must not contain email local-part")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password policy violation: " + "; ".join(errors)
        )


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user data"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def get_current_user(
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token)
) -> User:
    """Get current user from token"""
    username = token_data.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require administrator role"""
    if current_user.role != "administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required"
        )
    return current_user


def require_collector_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require collector or administrator role"""
    if current_user.role not in ["administrator", "collector"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Collector or Administrator access required"
        )
    return current_user


# Routes
@router.post("/setup-admin", response_model=TokenResponse)
def setup_admin(user_data: UserSetupAdmin, db: Session = Depends(get_db)):
    """Setup initial administrator account. Only works when no users exist."""
    # Check if any users exist
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin already exists. Use login instead."
        )
    
    # Check if username exists (shouldn't happen, but safety check)
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate password strength
    validate_password_strength(user_data.password, user_data.username, user_data.email)

    # Create administrator user (no password expiry)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        role="administrator"
    )
    new_user.set_password(user_data.password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create access token
    access_token = create_access_token(
        data={"sub": new_user.username, "role": new_user.role}
    )
    
    # Return response with flag indicating this is first admin (for dummy data prompt)
    user_dict = new_user.to_dict()
    user_dict["is_first_admin"] = True  # Flag to trigger dummy data prompt
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_dict
    }


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login with username and password"""
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user or not user.check_password(credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Enforce password expiry using password_expires_at field
    if user.password_expires_at:
        try:
            expiry_naive = user.password_expires_at.replace(tzinfo=None) if user.password_expires_at.tzinfo else user.password_expires_at
            if datetime.utcnow() > expiry_naive:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Password expired. Please contact an administrator to reset."
                )
        except Exception as e:
            logger.warning(f"Password expiry check failed for user {user.username}: {e}")
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.to_dict()
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user.to_dict()


@router.get("/check-setup")
def check_setup(db: Session = Depends(get_db)):
    """Check if initial admin setup is needed"""
    user_count = db.query(User).count()
    return {
        "needs_setup": user_count == 0,
        "user_count": user_count
    }


# Seed demo users endpoint removed for security:
# Administrator account must be created via /api/auth/setup-admin (deployer-provided credentials).
# No default admin:admin will ever be created by the system.


@router.post("/create-user", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user (admin only)"""
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    if user_data.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"
        )
    
    # Validate password strength
    validate_password_strength(user_data.password, user_data.username, user_data.email)

    # Create new user with configurable password expiry
    if user_data.password_expiry_days is None:
        expiry = None  # Never expire
    elif user_data.password_expiry_days == 0:
        expiry = None  # Never expire
    else:
        expiry = datetime.utcnow() + timedelta(days=user_data.password_expiry_days)
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        password_expires_at=expiry
    )
    new_user.set_password(user_data.password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info(f"Created user {new_user.username} role={new_user.role} active={new_user.is_active}")
    return new_user.to_dict()


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all users (admin only)"""
    users = db.query(User).all()
    return [user.to_dict() for user in users]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update user status or role (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deactivating themselves
    if user.id == current_user.id and user_update.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    # Prevent admin from removing their own admin role if they're the last admin
    if user.id == current_user.id and user_update.role in ["collector", "user"]:
        admin_count = db.query(User).filter(User.role == "administrator", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove administrator role. At least one administrator must exist."
            )
    
    # Update fields
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing = db.query(User).filter(User.email == user_update.email, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use by another user"
            )
        user.email = user_update.email
    
    if user_update.role is not None:
        if user_update.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"
            )
        user.role = user_update.role

    # Update password with configurable expiry
    if user_update.new_password:
        validate_password_strength(user_update.new_password, user.username, user.email)
        user.set_password(user_update.new_password)
        
        # Set expiry based on password_expiry_days if provided
        if user_update.password_expiry_days is not None:
            if user_update.password_expiry_days == 0:
                user.password_expires_at = None  # Never expire
            else:
                user.password_expires_at = datetime.utcnow() + timedelta(days=user_update.password_expiry_days)
        # If password_expiry_days not provided, keep existing expiry or set default
        elif user.password_expires_at is None:
            # Keep as never expire
            pass
        else:
            # Extend existing expiry by 90 days
            user.password_expires_at = datetime.utcnow() + timedelta(days=PASSWORD_MAX_AGE_DAYS)
    
    # Update expiry without password change
    elif user_update.password_expiry_days is not None:
        if user_update.password_expiry_days == 0:
            user.password_expires_at = None  # Never expire
        else:
            user.password_expires_at = datetime.utcnow() + timedelta(days=user_update.password_expiry_days)
    
    db.commit()
    db.refresh(user)
    
    return user.to_dict()


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Prevent deleting the last administrator
    if user.role == "administrator":
        admin_count = db.query(User).filter(User.role == "administrator", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last administrator user"
            )
    
    db.delete(user)
    db.commit()
    
    return {"message": f"User {user.username} deleted successfully"}


@router.post("/import-dummy-data")
def import_dummy_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Synchronous import endpoint (legacy). May take several minutes.
    Kept for backward compatibility, but prefer using the async start/status endpoints below.
    """
    import os
    import json
    from datetime import timedelta
    import random

    try:
        # Check if dummy data already imported
        from backend.models.credential import Credential
        existing_count = db.query(Credential).count()

        if existing_count > 1000:
            return {
                "status": "skipped",
                "message": f"Database already contains {existing_count:,} credentials. Dummy data import skipped.",
                "existing_credentials": existing_count
            }

        # Generate dummy data on-the-fly with random count
        logger.info("Starting dummy data generation...")
        from backend.dummy_data_generator import DummyDataGenerator

        generator = DummyDataGenerator(seed=None)
        credentials_data = generator.generate_batch(count=None)

        logger.info(f"Generated {len(credentials_data):,} credentials, starting import...")

        # Import credentials
        from backend.dummy_data_importer import DummyDataImporter
        importer = DummyDataImporter(db)


        # Import credentials in batches
        imported_count = importer.import_credentials(credentials_data, batch_size=1000)

        # Create dummy jobs
        jobs = importer.create_dummy_scan_jobs(num_jobs=10)
        scheduled_jobs = importer.create_dummy_scheduled_jobs(num_jobs=5)
        importer.link_credentials_to_jobs(jobs, max_creds_per_job=50)

        # Get statistics
        stats = importer.get_import_statistics()

        logger.info(f"Dummy data import complete: {imported_count:,} credentials imported")

        return {
            "status": "success",
            "message": f"Successfully imported {imported_count:,} dummy credentials",
            "statistics": stats
        }

    except Exception as e:
        logger.error(f"Error importing dummy data: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import dummy data: {str(e)}"
        )

# Async import implementation: start + status endpoints
@router.post("/import-dummy-start")
def import_dummy_start(
    current_user: User = Depends(require_admin),
):
    """
    Start dummy data import asynchronously. Returns 202 immediately.
    Frontend should poll /api/auth/dummy-import-status for progress.
    """
    import threading
    from backend.database import SessionLocal

    if DUMMY_IMPORT_STATE.get("running"):
        # Already running; return current status
        return {
            "status": "running",
            "progress": DUMMY_IMPORT_STATE["progress"],
            "message": DUMMY_IMPORT_STATE["message"],
        }

    # Reset state
    DUMMY_IMPORT_STATE.update({
        "running": True,
        "progress": 0,
        "message": "Starting dummy data import...",
        "error": None,
        "started_at": datetime.utcnow().isoformat(),
        "completed": False,
        "statistics": None,
    })

    def _run_import():
        db = SessionLocal()
        try:
            from backend.models.credential import Credential
            existing_count = db.query(Credential).count()
            if existing_count > 1000:
                DUMMY_IMPORT_STATE.update({
                    "running": False,
                    "completed": True,
                    "progress": 100,
                    "message": f"Database already contains {existing_count:,} credentials. Dummy data import skipped.",
                    "statistics": {
                        "existing_credentials": existing_count
                    }
                })
                return

            # 1) Generate data with random count for uniqueness
            DUMMY_IMPORT_STATE.update({"progress": 5, "message": "Generating dummy credentials..."})
            from backend.dummy_data_generator import DummyDataGenerator
            generator = DummyDataGenerator(seed=None)
            credentials_data = generator.generate_batch(count=None)

            # 2) Import batches with progress callback
            DUMMY_IMPORT_STATE.update({"progress": 10, "message": "Importing credentials (this may take several minutes)..."})
            from backend.dummy_data_importer import DummyDataImporter
            importer = DummyDataImporter(db)

            # Progress callback to update state during import
            def update_progress(progress, message):
                DUMMY_IMPORT_STATE.update({"progress": progress, "message": message})

            imported_count = importer.import_credentials(credentials_data, batch_size=1000, progress_callback=update_progress)

            # 3) Jobs and links
            DUMMY_IMPORT_STATE.update({"progress": 90, "message": "Creating sample jobs and linking credentials..."})
            jobs = importer.create_dummy_scan_jobs(num_jobs=10)
            scheduled_jobs = importer.create_dummy_scheduled_jobs(num_jobs=5)
            importer.link_credentials_to_jobs(jobs, max_creds_per_job=50)

            # 4) Stats and complete
            stats = importer.get_import_statistics()
            DUMMY_IMPORT_STATE.update({
                "progress": 100,
                "message": f"Successfully imported {imported_count:,} dummy credentials",
                "statistics": stats,
                "running": False,
                "completed": True,
            })
            logger.info(f"[DummyImport] Completed: {imported_count:,} credentials")
        except Exception as e:
            DUMMY_IMPORT_STATE.update({
                "running": False,
                "completed": False,
                "error": str(e),
                "message": "Dummy import failed",
            })
            logger.error(f"[DummyImport] Error: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

    threading.Thread(target=_run_import, daemon=True).start()

    return {
        "status": "started",
        "progress": 0,
        "message": "Dummy data import started. Poll status endpoint for progress.",
    }

@router.get("/dummy-import-status")
def dummy_import_status(
    current_user: User = Depends(require_admin),
):
    """
    Return current status of dummy data import.
    """
    return {
        "running": DUMMY_IMPORT_STATE["running"],
        "progress": DUMMY_IMPORT_STATE["progress"],
        "message": DUMMY_IMPORT_STATE["message"],
        "error": DUMMY_IMPORT_STATE["error"],
        "started_at": DUMMY_IMPORT_STATE["started_at"],
        "completed": DUMMY_IMPORT_STATE["completed"],
        "statistics": DUMMY_IMPORT_STATE["statistics"],
    }


@router.get("/check-dummy-data")
def check_dummy_data(db: Session = Depends(get_db)):
    """
    Check if dummy data has been imported.
    Returns false only if database is truly empty (< 100 credentials).
    This allows the prompt to show only for fresh deployments.
    """
    from backend.models.credential import Credential
    from backend.models.user import User as UserModel
    
    credential_count = db.query(Credential).count()
    dummy_user_exists = db.query(UserModel).filter(UserModel.username == 'dummy').first() is not None
    
    # Consider dummy data NOT imported only if database is nearly empty
    # This prevents showing prompt when database already has data
    has_dummy_data = credential_count >= 100
    
    return {
        "has_dummy_data": has_dummy_data,
        "credential_count": credential_count,
        "dummy_user_exists": dummy_user_exists,
        "should_offer_import": not has_dummy_data  # Only offer if < 100 credentials
    }