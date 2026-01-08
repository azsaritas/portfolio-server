import requests
from datetime import datetime, timedelta
import urllib3

# Suppress InsecureRequestWarning since we verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class TEFASClient:
    BASE_URL = "https://tefas.gov.tr/api/DB/"
    HEADERS = {
        "Connection": "keep-alive",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://tefas.gov.tr",
        "Referer": "https://tefas.gov.tr/TarihselVeriler.aspx",
    }

    def fetch_history(self, fund_code: str, days: int = 365):
        """
        Fetches historical data for a fund.
        Returns a list of dicts: [{'date': 'YYYY-MM-DD', 'price': float}, ...]
        """
        url = f"{self.BASE_URL}BindHistoryInfo"
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        payload = {
            "fontip": "YAT",
            "bastarih": start_date.strftime("%d.%m.%Y"),
            "bittarih": end_date.strftime("%d.%m.%Y"),
            "fonkod": fund_code.upper(),
        }

        try:
            response = requests.post(url, data=payload, headers=self.HEADERS, verify=False)
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and len(data['data']) > 0:
                    history = []
                    # Data layout from TEFAS: TARIH (unix timestamp ms), FIYAT (float)
                    # Actually check format from test: {'TARIH': 1735246800000, 'FIYAT': 0.1234}
                    for item in data['data']:
                        # TEFAS returns timestamp in ms, possibly as string
                        try:
                            ts = int(item['TARIH']) # Parse string to int
                        except ValueError:
                             # Fallback if it's not a timestamp (unlikely for this endpoint but safe)
                             continue
                        
                        date_str = datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d')
                        
                        # Handle Price (Turkish locale might use ,)
                        price_val = item['FIYAT']
                        if isinstance(price_val, str):
                            price_val = price_val.replace(',', '.')
                        price = float(price_val)
                        
                        history.append({'date': date_str, 'price': price})
                    
                    # Sort by date ascending
                    history.sort(key=lambda x: x['date'])
                    return history
            return []
        except Exception as e:
            print(f"TEFAS Fetch Error ({fund_code}): {e}")
            return []

    def get_fund_name(self, fund_code: str):
        """
        Scrapes fund name from TEFAS detail page.
        """
        url = f"https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod={fund_code.upper()}"
        try:
            # Standard requests, verify=False
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, verify=False)
            if response.status_code == 200:
                import re
                # Pattern: <span id="MainContent_LabelFonAdi">NAME</span>
                match = re.search(r'id="MainContent_LabelFonAdi">([^<]+)</span>', response.text)
                if match:
                    return match.group(1).strip()
        except Exception:
            pass
        return fund_code # Fallback

    def get_latest_price(self, fund_code: str):
        """
        Gets the latest available price for a fund.
        Returns float or None.
        """
        # Fetch last ~10 days to ensure we get a price (holidays etc)
        history = self.fetch_history(fund_code, days=10)
        if history:
            return history[-1]['price']
        return None

# Singleton instance
tefas_client = TEFASClient()
