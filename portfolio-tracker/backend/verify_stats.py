from database import SessionLocal
import crud
import json
from datetime import datetime

def test_stats():
    db = SessionLocal()
    try:
        print("Fetching portfolio stats...")
        stats = crud.get_portfolio_stats(db)
        
        # Serialize datetime for printing
        def default(o):
            if isinstance(o, (datetime)):
                return o.isoformat()
        
        print(json.dumps(stats, default=default, indent=2))
        
        if not stats:
            print("Stats is empty/None!")
        elif not stats.get('daily'):
             print("Daily stats missing!")
        else:
            print("Daily stats present:", stats['daily'].get('current'))

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_stats()
