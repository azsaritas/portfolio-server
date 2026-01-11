"""
In-memory caching module with TTL (Time-To-Live) support.
Optimized for multi-user production environment.
"""
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
import threading

class CacheEntry:
    """Single cache entry with value and expiration time."""
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
    
    def is_expired(self) -> bool:
        return datetime.now() > self.expires_at

class TTLCache:
    """Thread-safe in-memory cache with TTL support."""
    
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if exists and not expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if entry.is_expired():
                del self._cache[key]
                return None
            return entry.value
    
    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        """Set value in cache with TTL."""
        with self._lock:
            self._cache[key] = CacheEntry(value, ttl_seconds)
    
    def delete(self, key: str) -> None:
        """Delete a specific key from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def clear_pattern(self, pattern: str) -> None:
        """Clear all keys matching pattern (simple prefix match)."""
        with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]
    
    def clear_all(self) -> None:
        """Clear entire cache."""
        with self._lock:
            self._cache.clear()
    
    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        with self._lock:
            initial_count = len(self._cache)
            self._cache = {k: v for k, v in self._cache.items() if not v.is_expired()}
            return initial_count - len(self._cache)
    
    def stats(self) -> dict:
        """Get cache statistics."""
        with self._lock:
            total = len(self._cache)
            expired = sum(1 for v in self._cache.values() if v.is_expired())
            return {
                "total_entries": total,
                "expired_entries": expired,
                "active_entries": total - expired
            }

# Global cache instance
cache = TTLCache()

# Cache TTL constants (in seconds)
class CacheTTL:
    USD_RATE = 300         # 5 minutes for USD/TRY rate
    ASSET_PRICE = 60       # 1 minute for individual asset prices
    HOLDINGS = 30          # 30 seconds for holdings list
    PORTFOLIO_HISTORY = 120  # 2 minutes for portfolio history
    PORTFOLIO_STATS = 120    # 2 minutes for portfolio stats
    PORTFOLIO_TIMELINE = 60  # 1 minute for timeline

# Helper functions for common cache operations
def get_cached_or_fetch(key: str, fetch_func, ttl_seconds: int = 60) -> Any:
    """Get from cache or fetch using provided function."""
    cached = cache.get(key)
    if cached is not None:
        return cached
    
    value = fetch_func()
    if value is not None:
        cache.set(key, value, ttl_seconds)
    return value

def invalidate_user_cache(user_id: int) -> None:
    """Invalidate all cache entries for a specific user."""
    cache.clear_pattern(f"user:{user_id}:")

def make_user_cache_key(user_id: int, key_type: str) -> str:
    """Create a user-specific cache key."""
    return f"user:{user_id}:{key_type}"
