from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import crud, models, schemas
from database import SessionLocal, engine

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
def create_holding(holding: schemas.HoldingCreate, db: Session = Depends(get_db)):
    return crud.create_holding(db=db, holding=holding)

@app.get("/holdings", response_model=List[schemas.HoldingResponse])
def read_holdings(db: Session = Depends(get_db)):
    return crud.get_holdings(db)

@app.delete("/holdings/{holding_id}")
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    return crud.delete_holding(db=db, holding_id=holding_id)

@app.post("/holdings/{holding_id}/reduce")
def reduce_holding(holding_id: int, data: dict, db: Session = Depends(get_db)):
    """Reduce the quantity of a holding by a specified amount."""
    quantity = data.get("quantity", 0)
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    return crud.reduce_holding(db=db, holding_id=holding_id, quantity=quantity)

@app.post("/holdings/{holding_id}/update-cost")
def update_holding_cost(holding_id: int, data: dict, db: Session = Depends(get_db)):
    """Update the average cost of a holding."""
    average_cost = data.get("average_cost", 0)
    if average_cost <= 0:
        raise HTTPException(status_code=400, detail="Average cost must be positive")
    return crud.update_holding_cost(db=db, holding_id=holding_id, average_cost=average_cost)

@app.get("/price/{symbol}")
def get_price(symbol: str):
    return crud.get_price(symbol)

@app.get("/portfolio/history")
def get_portfolio_history(db: Session = Depends(get_db)):
    return crud.get_portfolio_history(db)
@app.get("/portfolio/stats")
def get_portfolio_stats(db: Session = Depends(get_db)):
    return crud.get_portfolio_stats(db)

@app.post("/refresh")
def refresh_prices(db: Session = Depends(get_db)):
    return crud.update_all_assets(db)

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
