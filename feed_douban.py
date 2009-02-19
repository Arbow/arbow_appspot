#!/usr/bin/env python
#coding=utf-8

import wsgiref.handlers
import feedparser
import PyRSS2Gen
import datetime, logging, random, utils
from xml.dom import minidom
from google.appengine.ext import webapp

FRIEND_URL = "http://api.douban.com/people/%s/friends?apikey=08f7c85a7775dc4f1ae7590f666194ed&max-results=50"
CONTACT_URL = "http://api.douban.com/people/%s/contacts?apikey=08f7c85a7775dc4f1ae7590f666194ed&max-results=50"
MINI_BLOG_URL = "http://www.douban.com/feed/people/%s/miniblogs"
MAX_ITEMS = 20

class FriendsFeedHandler(webapp.RequestHandler):
    
    def get(self):
        urlPath = self.request.path
        name = urlPath[14:]
        if '' == name:
            print "error, name missing!"
        else:
            self.fetch_friends(name)
    
    def fetch_friends(self, name):
        url = FRIEND_URL % name
        key = "/friends/" + name
        status, result = utils.cache_wget(url, timeout=1800, cache_key=key)
        if status == 200:
            author_name, friend_uids = self.parse_friends(result)
            url = CONTACT_URL % name
            key = "/contacts/" + name
            status, result = utils.cache_wget(url, timeout=1800, cache_key=key)
            if status == 200:
                author_name, contact_uids = self.parse_friends(result)
                friend_uids = friend_uids+ contact_uids
                friend_links = map(lambda uid: (uid,MINI_BLOG_URL % uid), friend_uids)
                feed_items = self.fetch_friends_feeds(friend_links)
                self.build_feeds_response(author_name, feed_items)                
            else:
                self.response.out.write(result)
        else:
            self.response.out.write("ERROR<br/>code=%i<br/>response=%s" % (status,result))
    
    def fetch_friends_feeds(self, links):
        lastBuildDate = None
        items = []
        for (uid,link) in links:
            key = "/miniblog/"+uid
            timeout = 1500 + int(random.random() * 600)
            status, result = utils.cache_wget(link, timeout=timeout, cache_key=key)
            if status == 200:
                charset = "utf-8"
                feed = feedparser.parse(result)
                for item in feed['entries']:
                    (Y,M,D,h,m,s,_,_,_) = item.updated_parsed
                    if not lastBuildDate:
                		lastBuildDate = datetime.datetime(Y,M,D,h,m,s)
                    feed_item = PyRSS2Gen.RSSItem(
                        title = item.title,
                        link = item.link,
                        guid = PyRSS2Gen.Guid(item.id, isPermaLink=False),
                        description = item.summary.encode(charset),
                        pubDate = datetime.datetime(Y,M,D,h,m,s)
                	)
                    items.append(feed_item)
            else:
                logging.warn("request %s failed, status code=%i", link, status)
        return items

    def parse_friends(self, content):
        xmldoc = minidom.parseString(content)
        name = xmldoc.getElementsByTagName('name')[0].childNodes[0].data.encode('utf-8')
        uids = xmldoc.getElementsByTagName('db:uid')
        friend_uids = []
        for uid in uids:
            friend_uids.append(uid.childNodes[0].data.encode())
        return (name, friend_uids)
        
    def build_feeds_response(self, name, feeds):
        lastBuildDate = None
        if len(feeds) > 0:
            #sort it first
            feeds.sort(lambda x,y:cmp(y.pubDate,x.pubDate))
            lastBuildDate = feeds[0].pubDate
        else:
            lastBuildDate = datetime.datetime.now()
                
        charset = "utf-8"
        rss = PyRSS2Gen.RSS2(
        	title = "%s's friends feed" % name,
        	link = "http://www.douban.com/contacts/",
        	description = name + "'s friend's miniblog at douban.com",
        	lastBuildDate = lastBuildDate,
        	items = feeds[:MAX_ITEMS]
        )
        self.response.headers['Content-Type'] = 'text/xml'
        self.response.out.write(rss.to_xml(encoding=charset))
        

def main():
    application = webapp.WSGIApplication(
        [('/feeds/douban/.*', FriendsFeedHandler)], debug=True
    )
    wsgiref.handlers.CGIHandler().run(application)


if __name__ == '__main__':
    main ()
