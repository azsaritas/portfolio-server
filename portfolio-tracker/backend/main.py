from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import crud, models, schemas
from database import SessionLocal, engine
from auth import get_current_user
from auth_routes import router as auth_router

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Tracker MVP")

# CORS Setup
origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
app.include_router(auth_router)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/assets", response_model=schemas.AssetResponse)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    return crud.create_asset(db=db, asset=asset)

@app.get("/assets", response_model=List[schemas.AssetResponse])
def read_assets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    assets = crud.get_assets(db, skip=skip, limit=limit)
    return assets

@app.post("/holdings", response_model=schemas.HoldingResponse)
def create_holding(
    holding: schemas.HoldingCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.create_holding(db=db, holding=holding, user_id=current_user.id)

@app.get("/holdings", response_model=List[schemas.HoldingResponse])
def read_holdings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_holdings(db, user_id=current_user.id)

@app.delete("/holdings/{holding_id}")
def delete_holding(
    holding_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.delete_holding(db=db, holding_id=holding_id, user_id=current_user.id)

@app.post("/holdings/{holding_id}/reduce")
def reduce_holding(
    holding_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Reduce the quantity of a holding by a specified amount."""
    quantity = data.get("quantity", 0)
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    return crud.reduce_holding(db=db, holding_id=holding_id, quantity=quantity, user_id=current_user.id)

@app.post("/holdings/{holding_id}/update-cost")
def update_holding_cost(
    holding_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update the average cost of a holding."""
    average_cost = data.get("average_cost", 0)
    if average_cost <= 0:
        raise HTTPException(status_code=400, detail="Average cost must be positive")
    return crud.update_holding_cost(db=db, holding_id=holding_id, average_cost=average_cost, user_id=current_user.id)

@app.get("/price/{symbol}")
def get_price(symbol: str):
    return crud.get_price(symbol)

@app.post("/portfolio/simulate")
def simulate_portfolio(request: schemas.SimulationRequest):
    return crud.simulate_portfolio(request)

@app.get("/portfolio/history")
def get_portfolio_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_portfolio_history(db, user_id=current_user.id)

@app.get("/portfolio/stats")
def get_portfolio_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_portfolio_stats(db, user_id=current_user.id)

@app.post("/refresh")
def refresh_prices(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_all_assets(db, user_id=current_user.id)

@app.get("/validate/fund/{code}")
def validate_fund(code: str):
    """Validate if a 3-letter code is a valid TEFAS fund and return its details."""
    from tefas import tefas_client
    
    code_upper = code.upper().strip()
    if len(code_upper) != 3 or not code_upper.isalnum():
        raise HTTPException(status_code=400, detail="Invalid fund code format. Must be 3 alphanumeric characters.")
    
    try:
        price = tefas_client.get_latest_price(code_upper)
        if price:
            name = tefas_client.get_fund_name(code_upper)
            return {"symbol": code_upper, "name": name, "price": price, "valid": True}
        else:
            raise HTTPException(status_code=404, detail=f"Fund {code_upper} not found on TEFAS")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Fund {code_upper} not found on TEFAS: {str(e)}")

# ============ Admin Endpoints ============

def get_admin_user(current_user: models.User = Depends(get_current_user)):
    """Dependency to verify user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@app.get("/admin/stats", response_model=schemas.AdminStatsResponse)
def admin_get_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Get system-wide statistics."""
    return crud.get_admin_stats(db)

@app.get("/admin/users", response_model=List[schemas.UserAdminResponse])
def admin_get_users(
    skip: int = 0,
    limit: int = 50,
    search: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Get all users with pagination and search."""
    return crud.get_all_users(db, skip=skip, limit=limit, search=search)

@app.get("/admin/users/{user_id}", response_model=schemas.UserAdminResponse)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Get a specific user by ID."""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get holdings info
    holdings = db.query(models.Holding).filter(models.Holding.user_id == user_id).all()
    total_value = 0.0
    for h in holdings:
        asset = db.query(models.Asset).filter(models.Asset.symbol == h.symbol).first()
        if asset and asset.last_price:
            total_value += h.quantity * asset.last_price
    
    return {
        "id": user.id,
        "email": user.email,
        "is_verified": user.is_verified,
        "is_admin": user.is_admin,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "holdings_count": len(holdings),
        "total_portfolio_value": total_value
    }

@app.put("/admin/users/{user_id}", response_model=schemas.UserAdminResponse)
def admin_update_user(
    user_id: int,
    update_data: schemas.UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Update a user's details."""
    user = crud.update_user_admin(db, user_id, update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get holdings info for response
    holdings = db.query(models.Holding).filter(models.Holding.user_id == user_id).all()
    total_value = 0.0
    for h in holdings:
        asset = db.query(models.Asset).filter(models.Asset.symbol == h.symbol).first()
        if asset and asset.last_price:
            total_value += h.quantity * asset.last_price
    
    return {
        "id": user.id,
        "email": user.email,
        "is_verified": user.is_verified,
        "is_admin": user.is_admin,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "holdings_count": len(holdings),
        "total_portfolio_value": total_value
    }

@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Delete a user and all their data."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    success = crud.delete_user_admin(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@app.get("/admin/activity", response_model=List[schemas.ActivityLogResponse])
def admin_get_activity(
    skip: int = 0,
    limit: int = 100,
    user_id: int = None,
    action: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Get activity logs with optional filters."""
    return crud.get_activity_logs(db, skip=skip, limit=limit, user_id=user_id, action=action)

@app.get("/admin/holdings", response_model=List[schemas.HoldingAdminResponse])
def admin_get_holdings(
    skip: int = 0,
    limit: int = 100,
    symbol: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user)
):
    """Get all holdings across all users."""
    return crud.get_all_holdings_admin(db, skip=skip, limit=limit, symbol=symbol)

