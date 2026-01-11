"""
Authentication utilities for JWT token handling and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional
import os

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
from database import get_db

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days
REFRESH_TOKEN_EXPIRE_DAYS = 365  # 1 year

print(f"[DEBUG AUTH] SECRET_KEY loaded: {SECRET_KEY[:10]}... (len: {len(SECRET_KEY)})")

# Use bcrypt directly instead of passlib to avoid wrap bug detection issues
import bcrypt

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    password_bytes = plain_password.encode('utf-8')[:72]  # Truncate to 72 bytes
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def hash_password(password: str) -> str:
    """Hash a password."""
    password_bytes = password.encode('utf-8')[:72]  # Truncate to 72 bytes
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        print(f"[DEBUG decode_token] Using SECRET_KEY: {SECRET_KEY[:10]}... (len: {len(SECRET_KEY)})")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        print(f"[DEBUG decode_token] JWT decode error: {type(e).__name__}: {e}")
        return None


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Get the current user from the JWT token.
    Raises HTTPException if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    print(f"[DEBUG] get_current_user called, token: {token[:50] if token else 'None'}...")
    
    if token is None:
        print("[DEBUG] Token is None")
        raise credentials_exception
    
    payload = decode_token(token)
    print(f"[DEBUG] Decoded payload: {payload}")
    
    if payload is None:
        print("[DEBUG] Payload is None - decode failed")
        raise credentials_exception
    
    # Check token type
    if payload.get("type") != "access":
        print(f"[DEBUG] Wrong token type: {payload.get('type')}")
        raise credentials_exception
    
    user_id = payload.get("sub")
    print(f"[DEBUG] user_id from payload: {user_id} (type: {type(user_id)})")
    
    if user_id is None:
        print("[DEBUG] user_id is None")
        raise credentials_exception
    
    # Convert to int if it's a string (JWT stores as string)
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        print(f"[DEBUG] Failed to convert user_id to int")
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    print(f"[DEBUG] Found user: {user}")
    
    if user is None:
        print("[DEBUG] User not found in DB")
        raise credentials_exception
    
    return user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """
    Get the current user if authenticated, otherwise return None.
    Useful for endpoints that work both authenticated and anonymously.
    """
    if token is None:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


def generate_reset_token() -> str:
    """Generate a random token for password reset."""
    import secrets
    return secrets.token_urlsafe(32)
