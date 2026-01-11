from sqlalchemy.orm import Session
import models, schemas
import yfinance as yf
import pandas as pd
from fastapi import HTTPException
from fastapi import HTTPException
from datetime import datetime
from tefas import tefas_client

def get_asset(db: Session, symbol: str):
    return db.query(models.Asset).filter(models.Asset.symbol == symbol).first()

def get_assets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Asset).offset(skip).limit(limit).all()

def create_asset(db: Session, asset: schemas.AssetCreate):
    # Normalize symbol
    symbol_upper = asset.symbol.upper().strip()
    
    # Cash handling: CASH_TRY, CASH_USD, CASH_EUR, etc.
    is_cash = symbol_upper.startswith("CASH_")
    
    # TEFAS Check: If 3 letters and alphanumeric, try TEFAS first
    is_tefas_candidate = len(symbol_upper) == 3 and symbol_upper.isalnum() and not is_cash
    
    current_price = None
    name = symbol_upper
    is_fund = False
    
    # Handle cash holdings
    if is_cash:
        currency_code = symbol_upper.replace("CASH_", "")
        currency_names = {
            "TRY": "Türk Lirası",
            "USD": "Amerikan Doları",
            "EUR": "Euro",
            "GBP": "İngiliz Sterlini",
            "CHF": "İsviçre Frangı",
            "JPY": "Japon Yeni",
            "GOLD": "Altın (Gram)",
        }
        name = currency_names.get(currency_code, f"Nakit {currency_code}")
        current_price = 1.0  # Cash is always 1:1

    elif is_tefas_candidate:
        try:
            fund_price = tefas_client.get_latest_price(symbol_upper)
            if fund_price:
                current_price = fund_price
                name = tefas_client.get_fund_name(symbol_upper)
                is_fund = True
        except:
            pass
            
    if not is_fund and not is_cash:
        # Fallback to YFinance / BIST Logic
        if "-" not in symbol_upper and "." not in symbol_upper and "=" not in symbol_upper:
            symbol_upper += ".IS"
        
        # Check if already exists (again, but with .IS suffix potentially)
        db_asset = get_asset(db, symbol_upper)
        if db_asset:
            raise HTTPException(status_code=400, detail="Asset already exists")
        
        # Fetch data from Yahoo Finance
        ticker = yf.Ticker(symbol_upper)
        try:
            # history check to validate symbol
            hist = ticker.history(period="1d")
            if hist.empty:
                 raise HTTPException(status_code=404, detail=f"Stock symbol {symbol_upper} not found in Yahoo Finance")
            
            # Get latest price
            current_price = hist['Close'].iloc[-1]
            # Get name
            name = ticker.info.get('shortName') or ticker.info.get('longName') or symbol_upper
    
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Error fetching data for {symbol_upper}: {str(e)}")

    db_asset = models.Asset(
        symbol=symbol_upper,
        name=name,
        last_price=float(current_price),
        last_updated=datetime.utcnow()
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

def get_usd_try_rate():
    try:
        ticker = yf.Ticker("USDTRY=X")
        # fast_info is good, or history
        price = ticker.fast_info.last_price
        if not price:
             hist = ticker.history(period="1d")
             if not hist.empty:
                 price = hist['Close'].iloc[-1]
        return price if price else 1.0 # Fallback
    except:
        return 1.0

def get_holdings(db: Session, user_id: int):
    holdings = db.query(models.Holding).filter(models.Holding.user_id == user_id).all()
    results = []
    
    # Fetch USD rate once
    usd_try_rate = get_usd_try_rate()
    
    for h in holdings:
        # Get latest price from Asset table
        asset = get_asset(db, h.symbol)
        current_price = asset.last_price if asset else 0.0
        
        # Calculate daily change percentage
        daily_change_pct = 0.0
        try:
            # Skip daily change for cash holdings
            if h.symbol.startswith("CASH_"):
                daily_change_pct = 0.0
            # Check if TEFAS (3-letter code, no suffix)
            elif len(h.symbol) == 3 and h.symbol.isalnum():
                # TEFAS fund - use tefas_client
                history = tefas_client.fetch_history(h.symbol, days=2)
                if history and len(history) >= 2:
                    prev_price = history[-2]['price']
                    curr_price = history[-1]['price']
                    if prev_price > 0:
                        daily_change_pct = ((curr_price - prev_price) / prev_price) * 100
            else:
                # YFinance asset (BIST, Crypto, Metals)
                ticker = yf.Ticker(h.symbol)
                hist = ticker.history(period="5d")  # Get 5 days for more reliable data
                if len(hist) >= 2:
                    prev_close = hist['Close'].iloc[-2]
                    curr_close = hist['Close'].iloc[-1]
                    if prev_close > 0:
                        daily_change_pct = ((curr_close - prev_close) / prev_close) * 100
        except Exception as e:
            # Debug: print error for troubleshooting
            print(f"Daily change error for {h.symbol}: {e}")
            daily_change_pct = 0.0
        
        # Determine Currency
        # Check for -USD (Crypto) or =F/=X (Futures/Metals which are usually USD)
        # Cash holdings: extract currency from symbol
        if h.symbol.startswith("CASH_"):
            cash_currency = h.symbol.replace("CASH_", "")
            currency = cash_currency  # Show actual currency
            
            # For foreign cash, use USDTRY rate (no individual yfinance calls)
            if cash_currency == "TRY":
                current_price = 1.0
                total_value = h.quantity
                total_value_try = h.quantity
            elif cash_currency == "USD":
                current_price = usd_try_rate
                total_value = h.quantity
                total_value_try = h.quantity * usd_try_rate
            elif cash_currency == "EUR":
                # EUR ≈ USD * 1.08 (approximate, can adjust)
                eur_try_rate = usd_try_rate * 1.10
                current_price = eur_try_rate
                total_value = h.quantity
                total_value_try = h.quantity * eur_try_rate
            elif cash_currency == "GBP":
                # GBP ≈ USD * 1.27 (approximate)
                gbp_try_rate = usd_try_rate * 1.27
                current_price = gbp_try_rate
                total_value = h.quantity
                total_value_try = h.quantity * gbp_try_rate
            else:
                # For other currencies, use USD rate as fallback
                current_price = usd_try_rate
                total_value = h.quantity
                total_value_try = h.quantity * usd_try_rate
            
            total_cost = h.quantity * h.average_cost
            profit_loss = 0.0  # Cash has no profit/loss
            profit_loss_pct = 0.0
            profit_loss_try = 0.0
        else:
            is_usd = "-USD" in h.symbol or "=" in h.symbol
            currency = "USD" if is_usd else "TRY"
        
            total_value = h.quantity * current_price # Native Value
            total_cost = h.quantity * h.average_cost # Native Cost
        
            profit_loss = total_value - total_cost
            profit_loss_pct = (profit_loss / total_cost * 100) if total_cost > 0 else 0.0

            # Calculate TRY equivalents
            if currency == "USD":
                total_value_try = total_value * usd_try_rate
                profit_loss_try = profit_loss * usd_try_rate
            else:
                total_value_try = total_value
                profit_loss_try = profit_loss

        results.append({
            "id": h.id,
            "symbol": h.symbol,
            "name": asset.name if asset else "",
            "quantity": h.quantity,
            "average_cost": h.average_cost,
            "current_price": current_price,
            "total_value": total_value,
            "profit_loss": profit_loss,
            "profit_loss_pct": profit_loss_pct,
            "currency": currency,
            "total_value_try": total_value_try,
            "profit_loss_try": profit_loss_try,
            "daily_change_pct": daily_change_pct
        })
    return results

def create_holding(db: Session, holding: schemas.HoldingCreate, user_id: int):
    # 1. Ensure Asset exists (fetch price)
    # Normalize symbol first
    symbol_upper = holding.symbol.upper().strip()
    
    # Check if cash holding - no external data needed
    is_cash = symbol_upper.startswith("CASH_")
    
    # Check if TEFAS candidate (before applying .IS suffix)
    is_tefas = False
    if not is_cash and len(symbol_upper) == 3 and symbol_upper.isalnum():
        try:
            fund_price = tefas_client.get_latest_price(symbol_upper)
            if fund_price:
                is_tefas = True
        except:
            pass
    
    # For non-TEFAS and non-Cash symbols, apply standard suffix logic
    if not is_tefas and not is_cash:
        if "-" not in symbol_upper and "." not in symbol_upper and "=" not in symbol_upper:
            symbol_upper += ".IS"
            
    # Check if asset exists
    asset = get_asset(db, symbol_upper)
    if not asset:
        try:
            # Create it - use the correctly normalized symbol
            asset = create_asset(db, schemas.AssetCreate(symbol=symbol_upper))
        except HTTPException as e:
            if e.status_code != 400:
                raise e
            # If 400 (already exists), just get it
            asset = get_asset(db, symbol_upper)

    # 2. Check if Holding exists for this user
    db_holding = db.query(models.Holding).filter(
        models.Holding.symbol == asset.symbol,
        models.Holding.user_id == user_id
    ).first()

    if db_holding:
        # Update existing holding (Weighted Average)
        total_current_cost = db_holding.quantity * db_holding.average_cost
        total_new_cost = holding.quantity * holding.unit_cost
        
        new_quantity = db_holding.quantity + holding.quantity
        new_average_cost = (total_current_cost + total_new_cost) / new_quantity
        
        db_holding.quantity = new_quantity
        db_holding.average_cost = new_average_cost
    else:
        # Create new holding
        db_holding = models.Holding(
            user_id=user_id,
            symbol=asset.symbol,
            quantity=holding.quantity,
            average_cost=holding.unit_cost
        )
        db.add(db_holding)

    # 3. Record transaction for timeline
    # Calculate current portfolio value (approximate)
    try:
        current_holdings = get_holdings(db, user_id)
        portfolio_value = sum(h.get('total_value_try', 0) for h in current_holdings)
    except:
        portfolio_value = None
    
    transaction = models.PortfolioTransaction(
        user_id=user_id,
        symbol=asset.symbol,
        asset_name=asset.name,
        quantity=holding.quantity,
        unit_cost=holding.unit_cost,
        total_cost=holding.quantity * holding.unit_cost,
        portfolio_value_at_time=portfolio_value
    )
    db.add(transaction)

    db.commit()
    db.refresh(db_holding)
    
    # Return formatted response
    return {
        "id": db_holding.id,
        "symbol": db_holding.symbol,
        "quantity": db_holding.quantity,
        "average_cost": db_holding.average_cost,
        "current_price": asset.last_price,
        "total_value": db_holding.quantity * asset.last_price,
        "profit_loss": (db_holding.quantity * asset.last_price) - (db_holding.quantity * db_holding.average_cost),
        "profit_loss_pct": 0.0 # Just calculate in frontend or reuse logic
    }

def delete_holding(db: Session, holding_id: int, user_id: int):
    from datetime import timedelta
    TURKEY_OFFSET = timedelta(hours=3)
    
    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.user_id == user_id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found or access denied")
    
    # Record removal transaction for timeline
    try:
        asset = get_asset(db, holding.symbol)
        current_holdings = get_holdings(db, user_id)
        portfolio_value = sum(h.get('total_value_try', 0) for h in current_holdings)
        
        # Create removal transaction (negative quantity)
        transaction = models.PortfolioTransaction(
            user_id=user_id,
            symbol=holding.symbol,
            asset_name=asset.name if asset else holding.symbol,
            quantity=-holding.quantity,  # Negative for removal
            unit_cost=holding.average_cost,
            total_cost=-(holding.quantity * holding.average_cost),  # Negative
            portfolio_value_at_time=portfolio_value
        )
        db.add(transaction)
    except:
        pass
    
    db.delete(holding)
    db.commit()
    return {"ok": True}

def reduce_holding(db: Session, holding_id: int, quantity: float, user_id: int):
    """Reduce the quantity of a holding by a specified amount."""
    from datetime import timedelta
    TURKEY_OFFSET = timedelta(hours=3)
    
    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.user_id == user_id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found or access denied")
    
    if quantity > holding.quantity:
        raise HTTPException(status_code=400, detail="Cannot reduce more than current quantity")
    
    # Record reduction transaction for timeline
    try:
        asset = get_asset(db, holding.symbol)
        current_holdings = get_holdings(db, user_id)
        portfolio_value = sum(h.get('total_value_try', 0) for h in current_holdings)
        
        # Create reduction transaction (negative quantity)
        transaction = models.PortfolioTransaction(
            user_id=user_id,
            symbol=holding.symbol,
            asset_name=asset.name if asset else holding.symbol,
            quantity=-quantity,  # Negative for reduction
            unit_cost=holding.average_cost,
            total_cost=-(quantity * holding.average_cost),  # Negative
            portfolio_value_at_time=portfolio_value
        )
        db.add(transaction)
    except:
        pass
    
    if quantity == holding.quantity:
        # Delete the holding completely
        db.delete(holding)
        db.commit()
        return {"ok": True, "deleted": True}
    
    # Reduce the quantity (average cost stays the same)
    holding.quantity = holding.quantity - quantity
    db.commit()
    db.refresh(holding)
    
    return {"ok": True, "remaining_quantity": holding.quantity}


def update_holding_cost(db: Session, holding_id: int, average_cost: float, user_id: int):
    """Update the average cost of a holding."""
    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.user_id == user_id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found or access denied")
    
    holding.average_cost = average_cost
    db.commit()
    db.refresh(holding)
    
    return {"ok": True, "new_average_cost": holding.average_cost}

def get_price(symbol: str):
    symbol_upper = symbol.upper().strip()
    
    # 1. Try TEFAS (if plausible candidate)
    if len(symbol_upper) == 3 and symbol_upper.isalnum():
        try:
            fund_price = tefas_client.get_latest_price(symbol_upper)
            if fund_price:
                return {"symbol": symbol_upper, "price": fund_price, "currency": "TRY"}
        except:
            pass
            
    # 2. Fallback to YFinance
    if "-" not in symbol_upper and "." not in symbol_upper and "=" not in symbol_upper:
        symbol_upper += ".IS"
    
    ticker = yf.Ticker(symbol_upper)
    try:
        # Get fast info first
        price = ticker.fast_info.last_price
        if not price:
             # Fallback to history
             hist = ticker.history(period="1d")
             if hist.empty:
                raise HTTPException(status_code=404, detail=f"Quote not found for symbol: {symbol_upper} (and failed TEFAS check)")
             price = hist['Close'].iloc[-1]
        
        return {"symbol": symbol_upper, "price": price, "currency": "TRY"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

def _calculate_portfolio_history(db: Session, user_id: int, period: str = "1mo"):
    holdings = get_holdings(db, user_id)
    if not holdings:
        return []

    portfolio_map = {h['symbol']: {'quantity': h['quantity'], 'currency': h['currency']} for h in holdings}
    all_symbols = list(portfolio_map.keys())
    
    # Identify TEFAS vs YFinance vs Cash
    # TEFAS: 3 chars, alnum, no specific suffix in our logic (but stored usually as XXX)
    # Cash: symbols starting with CASH_ - no external data needed
    cash_symbols = [s for s in all_symbols if s.startswith("CASH_")]
    tefas_symbols = [s for s in all_symbols if len(s) == 3 and s.isalnum() and s not in cash_symbols]
    yf_symbols = [s for s in all_symbols if s not in tefas_symbols and s not in cash_symbols]
    
    # Debug: show symbol categorization
    print(f"Portfolio History: All symbols = {all_symbols}")
    print(f"Portfolio History: TEFAS = {tefas_symbols}, YF = {yf_symbols}, Cash = {cash_symbols}")
    
    # Ensure USDTRY is fetched if needed
    has_usd = any(h['currency'] == 'USD' for h in holdings)
    if has_usd and "USDTRY=X" not in yf_symbols:
        yf_symbols.append("USDTRY=X")

    # Combined DataFrame
    combined_df = pd.DataFrame()

    # 1. Fetch YFinance Data
    if yf_symbols:
        tickers_str = " ".join(yf_symbols)
        try:
            # Remove group_by='ticker' to get standard (Price, Ticker) layout
            yf_data = yf.download(tickers_str, period=period, interval="1d", progress=False, auto_adjust=True)
            
            if not yf_data.empty:
                # Debug: print column structure
                # print(f"YF columns: {yf_data.columns.tolist()[:10]}")
                
                # Case 1: Multiple Tickers (MultiIndex Columns)
                if isinstance(yf_data.columns, pd.MultiIndex):
                    # Try to get Close prices - column structure varies by yfinance version
                    # New yfinance with auto_adjust=True: columns are (Price, Ticker)
                    # e.g. ('Close', 'THYAO.IS')
                    try:
                        if 'Close' in yf_data.columns.get_level_values(0):
                            combined_df = yf_data['Close'].copy()
                        elif 'Close' in yf_data.columns.get_level_values(1):
                            # Try swapping levels
                            yf_data.columns = yf_data.columns.swaplevel()
                            combined_df = yf_data['Close'].copy()
                    except:
                        pass
                
                # Case 2: Single Ticker (Flat Columns)
                elif 'Close' in yf_data.columns:
                    sym = yf_symbols[0]
                    combined_df = pd.DataFrame(index=yf_data.index)
                    combined_df[sym] = yf_data['Close']
                
                if not combined_df.empty:
                    combined_df.index = pd.to_datetime(combined_df.index).normalize()
                    
        except Exception as e:
            print(f"YF Fetch Error: {e}")
            # If YF fails, we might still have TEFAS data, so continue.

    # 2. Fetch TEFAS Data
    if tefas_symbols:
        days_map = {
            "1d": 5, "5d": 12, "1mo": 35, "3mo": 100, 
            "6mo": 200, "1y": 400, "2y": 800, "5y": 2000, "max": 5000
        }
        days = days_map.get(period, 365)
        
        for sym in tefas_symbols:
            try:
                hist = tefas_client.fetch_history(sym, days=days)
                if hist:
                    # Convert to DataFrame with proper column name
                    dates = [h['date'] for h in hist]
                    prices = [h['price'] for h in hist]
                    df_temp = pd.DataFrame({sym: prices}, index=pd.to_datetime(dates))
                    df_temp.index = df_temp.index.normalize()
                    
                    # Merge/Join
                    if combined_df.empty:
                        combined_df = df_temp
                    else:
                        combined_df = combined_df.join(df_temp, how='outer')
                else:
                    # No historical data - use current price as fallback
                    print(f"TEFAS {sym}: No history, using current price as fallback")
            except Exception as e:
                print(f"TEFAS Fetch Error ({sym}): {e}")
                # Fallback: Add TEFAS symbol with current price from holdings
                # This will be filled with ffill/bfill later
    
    # For any TEFAS symbols that failed to fetch, add them with holdings' current price
    failed_tefas = [s for s in tefas_symbols if s not in combined_df.columns]
    if failed_tefas and not combined_df.empty:
        print(f"Adding fallback prices for failed TEFAS: {failed_tefas}")
        for sym in failed_tefas:
            # Get current price from holdings
            holding = next((h for h in holdings if h['symbol'] == sym), None)
            if holding:
                combined_df[sym] = holding['current_price']

    if combined_df.empty:
        # If both YF and TEFAS failed, return cash-only history
        if cash_symbols:
            # Create a simple 30-day history with just cash
            from datetime import datetime, timedelta
            usd_rate = get_usd_try_rate()
            today = datetime.now().date()
            history = []
            for i in range(30, -1, -1):
                d = today - timedelta(days=i)
                total = 0
                for cash_sym in cash_symbols:
                    cash_info = portfolio_map.get(cash_sym, {})
                    qty = cash_info.get('quantity', 0)
                    cash_currency = cash_sym.replace("CASH_", "")
                    if cash_currency == "TRY":
                        total += qty
                    elif cash_currency == "USD":
                        total += qty * usd_rate
                    else:
                        total += qty
                if total > 0:
                    history.append({"date": d.strftime('%Y-%m-%d'), "value": total})
            return history
        return []
    
    # Debug: Print available columns
    print(f"Portfolio History: columns = {combined_df.columns.tolist()}")

    # 3. Clean and Calculate
    # Ffill/Bfill
    combined_df = combined_df.sort_index().ffill().bfill()
    
    daily_totals = {}
    
    for date, row in combined_df.iterrows():
        try:
            date_str = date.strftime('%Y-%m-%d')
            total_val_try = 0
            
            usd_rate = 1.0
            if has_usd and "USDTRY=X" in row:
                usd_rate = row["USDTRY=X"]
            
            for symbol in all_symbols:
                if symbol not in row: continue
                price = row[symbol]
                if pd.isna(price): continue
                
                qty = portfolio_map[symbol]['quantity']
                currency = portfolio_map[symbol]['currency']
                
                val = price * qty
                if currency == 'USD':
                    val *= usd_rate
                
                total_val_try += val
            
            # Add cash holdings (they don't have historical data, just use current value)
            for cash_sym in cash_symbols:
                cash_info = portfolio_map.get(cash_sym, {})
                qty = cash_info.get('quantity', 0)
                cash_currency = cash_sym.replace("CASH_", "")
                
                if cash_currency == "TRY":
                    total_val_try += qty
                elif cash_currency == "USD":
                    total_val_try += qty * usd_rate
                elif cash_currency == "EUR":
                    total_val_try += qty * usd_rate * 1.10
                elif cash_currency == "GBP":
                    total_val_try += qty * usd_rate * 1.27
                else:
                    total_val_try += qty  # Default to TRY
            
            if total_val_try > 0:
                daily_totals[date_str] = total_val_try
        except:
            continue

    history = [{"date": d, "value": v} for d, v in daily_totals.items()]
    history.sort(key=lambda x: x['date'])
    return history

def get_portfolio_history(db: Session, user_id: int):
    return _calculate_portfolio_history(db, user_id, period="1y")

def get_portfolio_stats(db: Session, user_id: int):
    # Fetch 2 years of history to ensure enough data for yearly comparison + history
    history = _calculate_portfolio_history(db, user_id, period="2y")
    if not history:
        return {}
    
    # Sort just in case
    history.sort(key=lambda x: x['date'])
    
    import datetime
    
    # Convert string dates to objects for comparison
    for h in history:
        if isinstance(h['date'], str):
            h['dt'] = datetime.datetime.strptime(h['date'], "%Y-%m-%d")
        else:
            h['dt'] = h['date']

    current_val = history[-1]['value']
    current_date = history[-1]['dt']

    def get_value_at_date(target_date):
        # Find closest date <= target_date
        closest = history[0]
        for h in reversed(history):
            if h['dt'] <= target_date:
                closest = h
                break
        return closest['value'], closest['date']

    def calculate_period_stats(days_per_period, history_count=10):
        # 1. Current Period (Now vs 1 period ago)
        val_now, _ = get_value_at_date(current_date)
        date_prev = current_date - datetime.timedelta(days=days_per_period)
        val_prev, _ = get_value_at_date(date_prev)
        
        diff_curr = val_now - val_prev
        pct_curr = (diff_curr / val_prev * 100) if val_prev > 0 else 0
        
        # 2. Previous Period (1 period ago vs 2 periods ago)
        date_prev_2 = date_prev - datetime.timedelta(days=days_per_period)
        val_prev_2, _ = get_value_at_date(date_prev_2)
        
        diff_prev_period = val_prev - val_prev_2
        pct_prev_period = (diff_prev_period / val_prev_2 * 100) if val_prev_2 > 0 else 0
        
        # 3. History List (Last N periods)
        # We want the change FOR that period. 
        # Period 0: Current (Now - Prev)
        # Period 1: Prev (Prev - Prev2)
        stats_history = []
        
        # Start from current
        curr_ref = current_date
        
        for i in range(history_count):
             d_end = curr_ref - datetime.timedelta(days=days_per_period * i)
             d_start = d_end - datetime.timedelta(days=days_per_period)
             
             v_end, date_label = get_value_at_date(d_end)
             v_start, _ = get_value_at_date(d_start)
             
             diff = v_end - v_start
             pct = (diff / v_start * 100) if v_start > 0 else 0
             
             stats_history.append({
                 "date": date_label,
                 "value": diff,
                 "percentage": pct,
                 "total_value": v_end
             })
        
        return {
            "current": {"value": diff_curr, "percentage": pct_curr},
            "previous": {"value": diff_prev_period, "percentage": pct_prev_period},
            "history": stats_history
        }

    return {
        "daily": calculate_period_stats(1),
        "weekly": calculate_period_stats(7),
        "monthly": calculate_period_stats(30),
        "yearly": calculate_period_stats(365)
    }

def update_all_assets(db: Session, user_id: int = None):
    # user_id is optional here - we update all assets (shared table)
    assets = db.query(models.Asset).all()
    count = 0
    
    # Needs to be optimized for batch fetch in future, but for MVP loop is okay
    for asset in assets:
        try:
            price = None
            
            # TEFAS Update Logic
            if len(asset.symbol) == 3 and asset.symbol.isalnum() and "." not in asset.symbol and "-" not in asset.symbol:
                # Likely a fund
                p = tefas_client.get_latest_price(asset.symbol)
                if p:
                    price = p
            
            # YFinance Update Logic
            if not price:
                ticker = yf.Ticker(asset.symbol)
                try:
                    price_yf = ticker.fast_info.last_price
                    if not price_yf:
                        hist = ticker.history(period="1d")
                        if not hist.empty:
                            price_yf = hist['Close'].iloc[-1]
                    if price_yf:
                         price = price_yf
                except:
                    pass
            
            if price:
                asset.last_price = float(price)
                asset.last_updated = datetime.utcnow()
                count += 1
        except Exception as e:
            print(f"Failed to update {asset.symbol}: {e}")
            continue

    db.commit()
    return {"updated": count}

# ============ Portfolio Simulation ============
def simulate_portfolio(request: schemas.SimulationRequest):
    # Separate items
    tickers = []
    funds = []
    
    # Map symbol -> quantity
    quantities = {}
    
    for item in request.items:
        symbol = item.symbol.upper().strip()
        quantities[symbol] = item.quantity
        
        # Identify type
        is_cash = symbol.startswith("CASH_")
        is_tefas = len(symbol) == 3 and symbol.isalnum() and not is_cash
        
        if is_tefas:
            funds.append(symbol)
        elif not is_cash:
            # YFinance Ticker
            if "-" not in symbol and "." not in symbol and "=" not in symbol:
                symbol += ".IS"
            tickers.append(symbol)
            quantities[symbol] = item.quantity

    # Date Range (Last 1 year)
    end_date = datetime.now()
    start_date = end_date - pd.Timedelta(days=365)
    
    # Master DataFrame
    master_df = pd.DataFrame(index=pd.date_range(start=start_date, end=end_date, freq='D'))
    
    # 1. Fetch YFinance Data
    data = None  # Initialize before try block
    if tickers:
        try:
            # Add USDTRY=X for conversion
            tickers_to_download = list(set(tickers + ["USDTRY=X"]))
            data = yf.download(tickers_to_download, start=start_date, end=end_date, progress=False)['Close']
            
            # If single ticker, data is Series (or DF with 1 col). If multiple, DF with cols.
            if isinstance(data, pd.Series):
                data = data.to_frame(name=tickers_to_download[0])
            
            # Normalize both indices to date-only for proper alignment
            data.index = pd.to_datetime(data.index).normalize()
            master_df.index = pd.to_datetime(master_df.index).normalize()
            
            # Reindex to master and forward fill
            data = data.reindex(master_df.index).ffill().bfill()
            
            # Process Tickers
            usd_rate_series = data["USDTRY=X"] if "USDTRY=X" in data.columns else pd.Series(30, index=master_df.index) 
            
            for ticker in tickers:
                if ticker in data.columns:
                    price_series = data[ticker]
                    qty = quantities.get(ticker, 0)
                    
                    # Convert USD assets to TRY
                    is_usd = False
                    if ticker.endswith("=F") or "-USD" in ticker:
                        is_usd = True
                    
                    if is_usd:
                        val_series = price_series * qty * usd_rate_series
                    else:
                        val_series = price_series * qty
                        
                    # Add to master
                    col_name = f"VAL_{ticker}"
                    master_df[col_name] = val_series
        except Exception as e:
            print(f"Simulation Error (YF): {e}")

    # 3. Aggregate
    val_cols = [c for c in master_df.columns if c.startswith("VAL_")]
    if val_cols:
        master_df['Total'] = master_df[val_cols].sum(axis=1)
    else:
        master_df['Total'] = 0
    
    # Fill remaining NaNs
    master_df['Total'] = master_df['Total'].ffill().fillna(0)
    
    # 4. Calculate Stats
    portfolio_series = master_df['Total']
    
    def get_change(days):
        if len(portfolio_series) < days + 1:
            return 0, 0
        now = portfolio_series.iloc[-1]
        prev = portfolio_series.iloc[-(days+1)]
        diff = now - prev
        pct = (diff / prev * 100) if prev > 0 else 0
        return diff, pct

    day_val, day_pct = get_change(1)
    week_val, week_pct = get_change(7)
    month_val, month_pct = get_change(30)
    year_val, year_pct = get_change(365)
    
    # History Graph (Filter out 0 values)
    history_json = []
    valid_series = portfolio_series[portfolio_series > 0]
    
    for date, val in valid_series.items():
        history_json.append({
            "date": date.strftime('%Y-%m-%d'),
            "value": val,
            "percentage": 0 
        })
        
    # 5. Calculate Holdings Details for Frontend
    simulated_holdings = []
    
    # Get latest USD rate for conversion
    usd_rate = 30.0
    data_exists = data is not None and isinstance(data, pd.DataFrame)
    if data_exists and isinstance(data, pd.DataFrame) and "USDTRY=X" in data.columns:
        last_usd = data["USDTRY=X"].dropna()
        if len(last_usd) > 0:
            usd_rate = float(last_usd.iloc[-1])

    for item in request.items:
        symbol = item.symbol.upper().strip()
        qty = item.quantity
        
        # Determine internal ticker symbol used in data
        ticker = symbol
        is_cash = symbol.startswith("CASH_")
        is_tefas = len(symbol) == 3 and symbol.isalnum() and not is_cash
        
        if not is_cash and not is_tefas:
            if "-" not in symbol and "." not in symbol and "=" not in symbol:
                ticker = symbol + ".IS"
        
        current_price = 0.0
        daily_change_pct = 0.0
        
        if is_cash:
            current_price = 1.0
        elif data_exists and isinstance(data, pd.DataFrame) and ticker in data.columns:
            series = data[ticker].dropna()
            if len(series) > 0:
                current_price = float(series.iloc[-1])
                # Find the last price that's different from current (actual trading day change)
                prev_price = current_price
                for i in range(2, min(len(series), 10)):  # Look back up to 10 days
                    potential_prev = float(series.iloc[-i])
                    if abs(potential_prev - current_price) > 0.0001:  # Found a different price
                        prev_price = potential_prev
                        break
                if prev_price > 0 and abs(prev_price - current_price) > 0.0001:
                    daily_change_pct = ((current_price - prev_price) / prev_price) * 100
        
        total_value = qty * current_price
        
        # Determine Currency
        currency = "TRY"
        if ticker.endswith("=F") or "-USD" in ticker:
            currency = "USD"
            
        total_value_try = total_value
        if currency == "USD":
            total_value_try = total_value * usd_rate
            
        simulated_holdings.append({
            "id": 0,
            "symbol": symbol,
            "name": symbol,
            "quantity": qty,
            "average_cost": 0,
            "current_price": current_price,
            "total_value": total_value,
            "profit_loss": 0,
            "profit_loss_pct": 0,
            "daily_change_pct": daily_change_pct,
            "currency": currency,
            "total_value_try": total_value_try,
            "profit_loss_try": 0
        })

    # Generate period histories
    def generate_period_history(days_per_period, count=10):
        hist = []
        total_len = len(portfolio_series)
        for i in range(count):
            end_idx = total_len - 1 - (days_per_period * i)
            start_idx = end_idx - days_per_period
            if start_idx < 0 or end_idx < 0:
                break
            
            end_val = float(portfolio_series.iloc[end_idx]) if end_idx < total_len else 0
            start_val = float(portfolio_series.iloc[start_idx]) if start_idx >= 0 and start_idx < total_len else 0
            
            diff = end_val - start_val
            pct = (diff / start_val * 100) if start_val > 0 else 0
            
            date_label = portfolio_series.index[end_idx].strftime('%Y-%m-%d') if end_idx < total_len else ""
            
            hist.append({
                "date": date_label,
                "value": diff,
                "percentage": pct,
                "total_value": end_val
            })
        return hist

    daily_history = generate_period_history(1, 10)
    weekly_history = generate_period_history(7, 10)
    monthly_history = generate_period_history(30, 12)
    yearly_history = generate_period_history(365, 5)

    return {
        "stats": {
            "daily": {
                "current": {"value": day_val, "percentage": day_pct},
                "previous": {"value": 0, "percentage": 0},
                "history": daily_history
            },
            "weekly": {
                "current": {"value": week_val, "percentage": week_pct},
                "previous": {"value": 0, "percentage": 0},
                "history": weekly_history
            },
            "monthly": {
                "current": {"value": month_val, "percentage": month_pct},
                "previous": {"value": 0, "percentage": 0},
                "history": monthly_history
            },
            "yearly": {
                "current": {"value": year_val, "percentage": year_pct},
                "previous": {"value": 0, "percentage": 0},
                "history": yearly_history
            },
        },
        "history": history_json,
        "holdings": simulated_holdings
    }

# ============ Admin Functions ============

def log_activity(db: Session, user_id: int = None, action: str = "", details: str = None, ip_address: str = None):
    """Log user activity to the database."""
    log = models.ActivityLog(
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    db.commit()
    return log

def get_admin_stats(db: Session):
    """Get system-wide statistics for admin dashboard."""
    from datetime import timedelta
    
    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified == True).count()
    
    # Active today (logged in within last 24 hours)
    today = datetime.utcnow() - timedelta(days=1)
    active_today = db.query(models.User).filter(models.User.last_login >= today).count()
    
    # Holdings stats
    total_holdings = db.query(models.Holding).count()
    
    # Total portfolio value calculation
    total_portfolio_value = 0.0
    holdings = db.query(models.Holding).all()
    for h in holdings:
        asset = db.query(models.Asset).filter(models.Asset.symbol == h.symbol).first()
        if asset and asset.last_price:
            total_portfolio_value += h.quantity * asset.last_price
    
    # Assets tracked
    total_assets = db.query(models.Asset).count()
    
    # Recent registrations (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = db.query(models.User).filter(models.User.created_at >= week_ago).count()
    
    return {
        "total_users": total_users,
        "verified_users": verified_users,
        "active_today": active_today,
        "total_holdings": total_holdings,
        "total_portfolio_value": total_portfolio_value,
        "total_assets_tracked": total_assets,
        "recent_registrations": recent_registrations
    }

def get_all_users(db: Session, skip: int = 0, limit: int = 50, search: str = None):
    """Get all users with pagination and optional search."""
    query = db.query(models.User)
    
    if search:
        query = query.filter(models.User.email.ilike(f"%{search}%"))
    
    users = query.order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for user in users:
        # Calculate holdings count and total value
        holdings = db.query(models.Holding).filter(models.Holding.user_id == user.id).all()
        holdings_count = len(holdings)
        total_value = 0.0
        
        for h in holdings:
            asset = db.query(models.Asset).filter(models.Asset.symbol == h.symbol).first()
            if asset and asset.last_price:
                total_value += h.quantity * asset.last_price
        
        result.append({
            "id": user.id,
            "email": user.email,
            "is_verified": user.is_verified,
            "is_admin": user.is_admin,
            "last_login": user.last_login,
            "created_at": user.created_at,
            "holdings_count": holdings_count,
            "total_portfolio_value": total_value
        })
    
    return result

def get_user_by_id(db: Session, user_id: int):
    """Get a specific user by ID."""
    return db.query(models.User).filter(models.User.id == user_id).first()

def update_user_admin(db: Session, user_id: int, update_data: schemas.UserUpdateRequest):
    """Admin update user details."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    if update_data.email is not None:
        user.email = update_data.email
    if update_data.is_verified is not None:
        user.is_verified = update_data.is_verified
    if update_data.is_admin is not None:
        user.is_admin = update_data.is_admin
    
    db.commit()
    db.refresh(user)
    return user

def delete_user_admin(db: Session, user_id: int):
    """Admin delete a user and all their data."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return False
    
    db.delete(user)
    db.commit()
    return True

def get_activity_logs(db: Session, skip: int = 0, limit: int = 100, user_id: int = None, action: str = None):
    """Get activity logs with optional filters."""
    query = db.query(models.ActivityLog)
    
    if user_id:
        query = query.filter(models.ActivityLog.user_id == user_id)
    if action:
        query = query.filter(models.ActivityLog.action == action)
    
    logs = query.order_by(models.ActivityLog.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for log in logs:
        user_email = None
        if log.user_id:
            user = db.query(models.User).filter(models.User.id == log.user_id).first()
            if user:
                user_email = user.email
        
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user_email,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at
        })
    
    return result

def get_all_holdings_admin(db: Session, skip: int = 0, limit: int = 100, symbol: str = None):
    """Get all holdings across all users for admin view."""
    query = db.query(models.Holding)
    
    if symbol:
        query = query.filter(models.Holding.symbol.ilike(f"%{symbol}%"))
    
    holdings = query.offset(skip).limit(limit).all()
    
    result = []
    for h in holdings:
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        asset = db.query(models.Asset).filter(models.Asset.symbol == h.symbol).first()
        
        current_value = 0.0
        if asset and asset.last_price:
            current_value = h.quantity * asset.last_price
        
        result.append({
            "id": h.id,
            "user_id": h.user_id,
            "user_email": user.email if user else "Unknown",
            "symbol": h.symbol,
            "quantity": h.quantity,
            "average_cost": h.average_cost,
            "current_value": current_value,
            "created_at": h.created_at if hasattr(h, 'created_at') else None
        })
    
    return result

# ============ Portfolio Timeline ============

def get_portfolio_timeline(db: Session, user_id: int):
    """Get portfolio timeline data with transaction points for the progress chart."""
    from datetime import timedelta
    
    # Turkey timezone offset (UTC+3)
    TURKEY_OFFSET = timedelta(hours=3)
    
    # Get all transactions for this user, ordered by date
    transactions = db.query(models.PortfolioTransaction).filter(
        models.PortfolioTransaction.user_id == user_id
    ).order_by(models.PortfolioTransaction.created_at.asc()).all()
    
    if not transactions:
        return {"timeline": [], "transactions": []}
    
    # Build transaction responses
    transaction_responses = []
    
    for tx in transactions:
        # Convert to Turkey time
        turkey_time = tx.created_at + TURKEY_OFFSET
        
        tx_response = {
            "id": tx.id,
            "symbol": tx.symbol,
            "asset_name": tx.asset_name,
            "quantity": tx.quantity,
            "unit_cost": tx.unit_cost,
            "total_cost": tx.total_cost,
            "portfolio_value_at_time": tx.portfolio_value_at_time,
            "created_at": turkey_time.isoformat()
        }
        transaction_responses.append(tx_response)
    
    # Group transactions by DATE (not datetime) for better chart display
    daily_data = {}
    running_value = 0
    
    for tx in transactions:
        # Convert to Turkey time
        turkey_time = tx.created_at + TURKEY_OFFSET
        date_key = turkey_time.strftime('%Y-%m-%d')
        
        # Update running value
        if tx.portfolio_value_at_time:
            running_value = tx.portfolio_value_at_time
        else:
            running_value += tx.total_cost
        
        # Create tx response with Turkey time
        tx_response = {
            "id": tx.id,
            "symbol": tx.symbol,
            "asset_name": tx.asset_name,
            "quantity": tx.quantity,
            "unit_cost": tx.unit_cost,
            "total_cost": tx.total_cost,
            "portfolio_value_at_time": tx.portfolio_value_at_time,
            "created_at": turkey_time.isoformat()
        }
        
        if date_key not in daily_data:
            daily_data[date_key] = {
                "date": date_key,
                "value": running_value,
                "transactions": [tx_response],
                "transaction_count": 1
            }
        else:
            daily_data[date_key]["value"] = running_value
            daily_data[date_key]["transactions"].append(tx_response)
            daily_data[date_key]["transaction_count"] += 1
    
    # Convert to sorted list
    timeline = []
    for date_key in sorted(daily_data.keys()):
        entry = daily_data[date_key]
        timeline.append({
            "date": entry["date"],
            "value": entry["value"],
            "transactions": entry["transactions"],
            "transaction_count": entry["transaction_count"]
        })
    
    # Add current portfolio value for today (if not already in the data)
    try:
        current_holdings = get_holdings(db, user_id)
        current_value = sum(h.get('total_value_try', 0) for h in current_holdings)
        
        # Get today's date in Turkey time
        now_turkey = datetime.utcnow() + TURKEY_OFFSET
        today_key = now_turkey.strftime('%Y-%m-%d')
        
        # Check if today's date already exists in the data
        existing_today = False
        for i, point in enumerate(timeline):
            if point['date'] == today_key:
                # Update today's value to current portfolio value
                timeline[i]["value"] = current_value
                existing_today = True
                break
        
        # If today doesn't exist, add it
        if not existing_today:
            timeline.append({
                "date": today_key,
                "value": current_value,
                "transactions": [],
                "transaction_count": 0
            })
            # Re-sort timeline by date to handle any future dates
            timeline = sorted(timeline, key=lambda x: x['date'])
    except:
        pass
    
    return {
        "timeline": timeline,
        "transactions": transaction_responses
    }

def reset_portfolio_timeline(db: Session, user_id: int):
    """Reset timeline by deleting all transactions and creating new ones from current holdings."""
    # 1. Delete all existing transactions for this user
    db.query(models.PortfolioTransaction).filter(
        models.PortfolioTransaction.user_id == user_id
    ).delete()
    db.commit()
    
    # 2. Get current holdings
    holdings = db.query(models.Holding).filter(models.Holding.user_id == user_id).all()
    
    if not holdings:
        return {"message": "No holdings to reset", "transactions_created": 0}
    
    # 3. Calculate current portfolio value
    current_value = 0
    for h in holdings:
        asset = get_asset(db, h.symbol)
        if asset and asset.last_price:
            # Determine if USD asset
            is_usd = "-USD" in h.symbol or "=" in h.symbol
            val = h.quantity * asset.last_price
            if is_usd:
                usd_rate = get_usd_try_rate()
                val *= usd_rate
            current_value += val
    
    # 4. Create new transactions for each holding (as if they were all added now)
    count = 0
    for h in holdings:
        asset = get_asset(db, h.symbol)
        
        transaction = models.PortfolioTransaction(
            user_id=user_id,
            symbol=h.symbol,
            asset_name=asset.name if asset else h.symbol,
            quantity=h.quantity,
            unit_cost=h.average_cost,
            total_cost=h.quantity * h.average_cost,
            portfolio_value_at_time=current_value
        )
        db.add(transaction)
        count += 1
    
    db.commit()
    
    return {"message": "Timeline reset successfully", "transactions_created": count}
