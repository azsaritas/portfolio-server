from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

# ============ Asset & Holding Schemas ============
class AssetBase(BaseModel):
    symbol: str

class AssetCreate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int
    name: str
    last_price: float
    last_updated: datetime

    class Config:
        from_attributes = True

class HoldingBase(BaseModel):
    symbol: str

class HoldingCreate(HoldingBase):
    quantity: float
    unit_cost: float

class HoldingResponse(HoldingBase):
    id: int
    name: str = ""
    quantity: float
    average_cost: float
    current_price: float = 0.0
    total_value: float = 0.0
    profit_loss: float = 0.0
    profit_loss_pct: float = 0.0
    total_value_try: float = 0.0
    profit_loss_try: float = 0.0
    daily_change_pct: float = 0.0
    daily_change_value_try: float = 0.0
    currency: str = "TRY"

    class Config:
        from_attributes = True

# ============ Auth Schemas ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str

class GoogleAuthRequest(BaseModel):
    credential: str

# ============ Simulation Schemas ============
class SimulationItem(BaseModel):
    symbol: str
    quantity: float

class SimulationRequest(BaseModel):
    items: List[SimulationItem]

# ============ Portfolio Timeline Schemas ============

class PortfolioTransactionResponse(BaseModel):
    id: int
    symbol: str
    asset_name: Optional[str] = None
    quantity: float
    unit_cost: float
    total_cost: float
    portfolio_value_at_time: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PortfolioTimelinePoint(BaseModel):
    date: str
    value: float
    transaction: Optional[PortfolioTransactionResponse] = None

# ============ Admin Schemas ============

class UserAdminResponse(BaseModel):
    id: int
    email: str
    is_verified: bool
    is_admin: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    holdings_count: int = 0
    total_portfolio_value: float = 0.0

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    is_verified: Optional[bool] = None
    is_admin: Optional[bool] = None

class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AdminStatsResponse(BaseModel):
    total_users: int
    verified_users: int
    active_today: int
    total_holdings: int
    total_portfolio_value: float
    total_assets_tracked: int
    recent_registrations: int  # Last 7 days

class HoldingAdminResponse(BaseModel):
    id: int
    user_id: int
    user_email: str
    symbol: str
    quantity: float
    average_cost: float
    current_value: float = 0.0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
