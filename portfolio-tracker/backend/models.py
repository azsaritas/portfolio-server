from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from database import Base

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
    symbol = Column(String, unique=True, index=True)
    quantity = Column(Float, default=0.0)
    average_cost = Column(Float, default=0.0)
