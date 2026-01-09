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

