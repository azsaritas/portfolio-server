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
