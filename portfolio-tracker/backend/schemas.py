from pydantic import BaseModel
from datetime import datetime

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
