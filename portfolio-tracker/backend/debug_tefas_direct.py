from tefas import tefas_client

def debug_tefas():
    symbol = "MAC"
    print(f"Testing TEFAS for {symbol}")
    try:
        price = tefas_client.get_latest_price(symbol)
        print(f"Result: {price}")
        
        name = tefas_client.get_fund_name(symbol)
        print(f"Name: {name}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    debug_tefas()
