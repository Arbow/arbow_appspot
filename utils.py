from google.appengine.api import memcache
from google.appengine.api import urlfetch
import logging

def cache_wget(url, timeout=600, cache_key=None):
    if cache_key == None:
        cache_key = url
    result = memcache.get(cache_key)
    if result == None:
        result = urlfetch.fetch(url)
        if result.status_code == 200:
            logging.info("fetch url %s success" % url)
            memcache.set(cache_key, result.content, timeout, 10240)
        else:
            logging.info("fetch url %s failed" % url)
        return (result.status_code, result.content)
    else:
        logging.info("fetch url from cache %s" % url)
        return (200, result)
