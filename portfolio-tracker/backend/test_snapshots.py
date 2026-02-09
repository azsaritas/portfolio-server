"""
Test script for daily snapshots feature.
This script inserts fake historical snapshot data so you can test
that adding new holdings doesn't change historical values.

Usage:
1. Run this script: python test_snapshots.py
2. Check the frontend - you should see historical data in Daily Performance
3. Add a new holding in the frontend
4. Refresh - historical values should remain the same, only today's value should change
"""

from datetime import date, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
import models

def create_test_snapshots(user_id: int):
    db = SessionLocal()
    
    try:
        # Clear existing snapshots for clean test
        db.query(models.DailySnapshot).filter(
            models.DailySnapshot.user_id == user_id
        ).delete()
        db.commit()
        print(f"Cleared existing snapshots for user {user_id}")
        
        # Create fake historical snapshots (last 10 days)
        today = date.today()
        test_data = [
            # (days_ago, total_value, daily_change_value, daily_change_pct)
            (10, 100000, 500, 8.50),
            (9, 100500, -200, -0.20),
            (8, 100300, 1000, 1.00),
            (7, 101300, -500, -0.49),
            (6, 100800, 15850, 15.80),
            (5, 101600, 1500, 1.48),
            (4, 103100, -800, -0.78),
            (3, 102300, 2000, 1.96),
            (2, 104300, 500, 0.48),
            (1, 104800, -300, -0.29),  # Yesterday
        ]
        
        for days_ago, total_value, daily_change_value, daily_change_pct in test_data:
            snapshot_date = today - timedelta(days=days_ago)
            snapshot = models.DailySnapshot(
                user_id=user_id,
                date=snapshot_date,
                total_value_try=total_value,
                daily_change_value=daily_change_value,
                daily_change_pct=daily_change_pct
            )
            db.add(snapshot)
            print(f"  Created snapshot: {snapshot_date} - Value: {total_value:,} TRY, Change: {daily_change_value:+,} ({daily_change_pct:+.2f}%)")
        
        db.commit()
        print(f"\n✅ Created {len(test_data)} test snapshots for user {user_id}")
        print("\n📋 Test Steps:")
        print("1. Refresh the frontend - you should see historical daily returns")
        print("2. Note down the historical values (e.g., yesterday: -300 TRY)")
        print("3. Add a new holding in the frontend")
        print("4. Refresh again - historical values should be EXACTLY the same")
        print("5. Only TODAY's value should change to reflect the new holding")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

def list_snapshots(user_id: int):
    db = SessionLocal()
    try:
        snapshots = db.query(models.DailySnapshot).filter(
            models.DailySnapshot.user_id == user_id
        ).order_by(models.DailySnapshot.date.desc()).all()
        
        print(f"\n📊 Snapshots for user {user_id}:")
        print("-" * 60)
        for s in snapshots:
            print(f"  {s.date} | Value: {s.total_value_try:>10,.0f} TRY | Change: {s.daily_change_value:>+8,.0f} ({s.daily_change_pct:>+6.2f}%)")
        print("-" * 60)
        print(f"Total: {len(snapshots)} snapshots")
    finally:
        db.close()

if __name__ == "__main__":
    # Get user ID - you can change this if needed
    # Default is user ID 1, change if your user has a different ID
    import sys
    
    user_id = 4
    if len(sys.argv) > 1:
        try:
            user_id = int(sys.argv[1])
        except:
            pass
    
    print(f"🧪 Daily Snapshots Test Script")
    print(f"User ID: {user_id}")
    print("=" * 60)
    
    # Create test data
    create_test_snapshots(user_id)
    
    # List all snapshots
    list_snapshots(user_id)
