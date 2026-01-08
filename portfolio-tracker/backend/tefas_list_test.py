import requests
import json

def test_tefas_list():
    # Attempt to get a list using Comparison Endpoint
    url = "https://tefas.gov.tr/api/DB/BindComparisonFundMainInfo"
    
    headers = {
        "Connection": "keep-alive",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://tefas.gov.tr/TarihselVeriler.aspx",
        "Origin": "https://tefas.gov.tr",
    }
    
    # Payload
    payload = {
        "fontip": "YAT",
        "fonkurucusu": "",
        "portfoyyoneticisi": ""
    }
    
    print(f"Sending request to {url}...")
    
    try:
        response = requests.post(url, data=payload, headers=headers, verify=False)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'data' in data and len(data['data']) > 0:
                    print(f"Successfully fetched {len(data['data'])} funds.")
                    print("First fund:", data['data'][0])
                    return True
            except json.JSONDecodeError:
                print("JSON Decode Error. Response text start:")
                print(response.text[:200])
                return False
        else:
            print("Status not 200.")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_tefas_list()
