from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # null for Google-only users
    google_id = Column(String, nullable=True, unique=True)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)  # Admin flag
    last_login = Column(DateTime, nullable=True)  # Last login timestamp
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    holdings = relationship("Holding", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("PortfolioTransaction", back_populates="user", cascade="all, delete-orphan")
    daily_snapshots = relationship("DailySnapshot", back_populates="user", cascade="all, delete-orphan")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    name = Column(String)
    last_price = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, index=True)  # Removed unique constraint - multiple users can hold same symbol
    quantity = Column(Float, default=0.0)
    average_cost = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="holdings")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for system actions
    action = Column(String, nullable=False)  # LOGIN, LOGOUT, ADD_HOLDING, REMOVE_HOLDING, REGISTER, etc.
    details = Column(Text, nullable=True)  # JSON string with additional info
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="activity_logs")

class PortfolioTransaction(Base):
    """Tracks individual asset additions to the portfolio for timeline view."""
    __tablename__ = "portfolio_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    asset_name = Column(String, nullable=True)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    portfolio_value_at_time = Column(Float, nullable=True)  # Portfolio value at transaction time
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="transactions")

class DailySnapshot(Base):
    """Stores end-of-day portfolio snapshots for each user."""
    __tablename__ = "daily_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    total_value_try = Column(Float, default=0.0)
    daily_change_value = Column(Float, default=0.0)  # Sum of all holdings' daily_change_value_try
    daily_change_pct = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="daily_snapshots")
    
    __table_args__ = (UniqueConstraint('user_id', 'date', name='uix_user_date'),)
