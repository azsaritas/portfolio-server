import requests
import pandas as pd
from datetime import datetime, timedelta

def test_tefas_fetch():
    url = "https://tefas.gov.tr/api/DB/BindHistoryInfo"
    
    # Headers are crucial for TEFAS
    headers = {
        "Connection": "keep-alive",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://tefas.gov.tr",
        "Referer": "https://tefas.gov.tr/TarihselVeriler.aspx",
    }
    
    # Get last 30 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Form input format: 01.01.2025
    payload = {
        "fontip": "YAT", # Investment Funds
        "bastarih": start_date.strftime("%d.%m.%Y"),
        "bittarih": end_date.strftime("%d.%m.%Y"),
        "fonkod": "MAC", # Example Fund
    }
    
    print(f"Sending request to {url} with payload {payload}")
    
    try:
        response = requests.post(url, data=payload, headers=headers, verify=False)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # print(f"Response: {data}")
            
            if 'data' in data and len(data['data']) > 0:
                print(f"Successfully fetched {len(data['data'])} records.")
                print("First record:", data['data'][0])
                return True
            else:
                print("Response JSON valid but no data found.")
                return False
        else:
            print("Failed.")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_tefas_fetch()
