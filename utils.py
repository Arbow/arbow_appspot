#coding=utf-8

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.api import urlfetch
import logging
import feed

feed_manager = feed.FeedManager()

#urlfetch一个链接，当缓存中存在时马上返回
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

def fetch_url(url, timeout=600, cache_key=None):
    if cache_key == None:
        cache_key = url    
    result = urlfetch.fetch(url)
    if result.status_code == 200:
        logging.info("fetch url %s success, store it" % url)
        memcache.set(cache_key, result.content, timeout, 10240)
    else:
        logging.info("fetch url %s failed" % url)
    return (result.status_code, result.content)    

def batch_cache_wget(url_pair_list, timeout=3600):
    """ 批量获取[(key,url),(key,url),...]的内容，返回{key:content,key:content,...}"""
    keys = map(lambda (k,u): k, url_pair_list)
    cached_result = memcache.get_multi(keys)
    cached_keys = cached_result.keys()
    for k,u in url_pair_list:
        if k not in cached_keys:
            content = feed_manager.fetch_feed_content_by_cachekey(k,u)
            if content != None:
                memcache.set(k, content, timeout, 10240)
                cached_result[k] = content
    return cached_result

def refresh_feeds(max_size=10):
    feeds = feed_manager.fetch_need_update_feeds(max_size)
    keys = map(lambda f:f.cacheKey, feeds)
    #logging.info("refresh batch feeds: %s" % str(keys))
    updated_feeds = []
    for feed in feeds:
        status, content = fetch_url(feed.url, timeout=3600, cache_key=feed.cacheKey)
        if status == 200:
            feed.content = db.Text(content, encoding="utf8")
            updated_feeds.append(feed)
    feed_manager.batch_update_feeds(updated_feeds)
    
    
