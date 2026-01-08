import requests
import re

def scrape_tefas_funds():
    url = "https://www.tefas.gov.tr/FonAnaliz.aspx"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    print(f"Fetching {url}...")
    try:
        response = requests.get(url, headers=headers, verify=False)
        if response.status_code == 200:
            # Look for fund codes.
            # Usually they are inside links or attributes.
            # Example: <a href="FonAnaliz.aspx?FonKod=MAC">...</a>
            
            # Pattern: ?FonKod=XYZ or data-fonkod="XYZ"
            # Codes are usually 3 uppercase letters.
            
            content = response.text
            print(f"Content length: {len(content)}")
            
            # Simple regex for FonKod=XXX
            matches = re.findall(r'FonKod=([A-Z0-9]{3})', content)
            unique_funds = sorted(list(set(matches)))
            
            if len(unique_funds) > 0:
                print(f"Found {len(unique_funds)} unique fund codes.")
                print(f"First 10: {unique_funds[:10]}")
                return True
            else:
                print("No funds found with simple regex.")
                # print snippet
                # print(content[:500])
                return False
        else:
            print(f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    scrape_tefas_funds()
