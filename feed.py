#!/usr/bin/env python
#coding=utf-8

from google.appengine.ext import db
from datetime import datetime
import logging

class DoubanFeed(db.Model):
    url = db.StringProperty(required=True)
    cacheKey = db.StringProperty(required=True)
    content = db.TextProperty()
    refreshTime = db.DateTimeProperty()
    
class FeedManager(object):
    
    def add_new_feed(self, cache_key, feed_url):
        #check exist first
        query = db.GqlQuery("SELECT * FROM DoubanFeed WHERE cacheKey = :1", cache_key)
        if query.count() == 0:
            default_content = db.Text("", encoding="utf8")
            feed = DoubanFeed(url=feed_url,cacheKey=cache_key,content=default_content,refreshTime=datetime(2000, 1, 1))
            feed.put()
            logging.info("add feed item to datastore, url=",feed_url)
    
    def fetch_feed_content(self, feed_url):
        query = db.GqlQuery("SELECT * FROM DoubanFeed WHERE url = :1", feed_url)
        if query.count() > 0:
            feed = query.get()
            return feed.content
        else:
            add_new_feed(feed_url)
            return None
        
    def fetch_feed_content_by_cachekey(self, key):
        query = db.GqlQuery("SELECT * FROM DoubanFeed WHERE cacheKey = :1", key)
        if query.count() > 0:
            feed = query.get()
            return feed.content
        else:
            add_new_feed(feed_url)
            return None
    
    def fetch_need_update_feeds(self, max_size):
        return db.Query(DoubanFeed).order('refreshTime').fetch(max_size)
    
    def batch_update_feeds(self, feeds):
        now = datetime.now()
        for feed in feeds:
            if feed.content != "":
                feed.refreshTime = now
                feed.put()
    
        