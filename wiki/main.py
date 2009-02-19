#!/usr/bin/env python
import os, datetime, re, logging
import wsgiref.handlers
from google.appengine.ext import webapp, db
from google.appengine.api import users

# base for reading files
BASE = os.path.dirname(__file__)

# max # of supported tiddlers
UPPER_LIMIT = 5000

# dashed-names-only
PAGE_REGEX = '(?:[a-z]+-)*[a-z]+'

################ Models ##################
class Page(db.Model):
  name = db.StringProperty()
  owner = db.UserProperty()
  created = db.DateTimeProperty(auto_now_add=True)

class Tiddler(db.Model):
  page = db.ReferenceProperty(Page)
  title = db.StringProperty()
  modified = db.DateTimeProperty(auto_now=True)
  modifier = db.UserProperty()  
  contents = db.TextProperty()
  tags = db.ListProperty(str)
  created = db.DateTimeProperty(auto_now_add=True)
  deleted = db.BooleanProperty(default=False)

########### Query Functions ################
  
by_title_q = Tiddler.gql("WHERE page = :1 and title = :2 and deleted = False")
all_tiddlers_q = Tiddler.gql("WHERE page = :1 and deleted = False")
since_q = Tiddler.gql("WHERE page = :1 and modified >= :2")    # includes deleted
page_q = Page.gql("WHERE name = :1")

pagecache = {}
def get_page(pagename):
  if pagename in pagecache:
    return pagecache[pagename]
  page_q.bind(pagename)
  result = pagecache[pagename] = page_q.get()
  return result
  
def get_or_make_page(pagename):
  if pagename in pagecache:
    return pagecache[pagename]
  page_q.bind(pagename)
  result = page_q.get()
  if result is None:
    result = Page(name=pagename, owner=users.get_current_user())
    result.put()
  pagecache[pagename] = result
  return result
  
def find_by_title(page, title):
  by_title_q.bind(page, title)
  return by_title_q.get()
  
def get_since(page, dt):
  since_q.bind(page, dt)
  return since_q
  
def all_tiddlers(page):
  all_tiddlers_q.bind(page)
  return all_tiddlers_q.fetch(UPPER_LIMIT)
  
############## App Logic #####################
class ClassicTiddlerFormat:
  FORMAT = '<div tiddler="%s" modified="%s" modifier="%s" tags="%s">%s</div>'
  def format_one(self, tiddler):   
    from cgi import escape
    result = self.FORMAT
    result %= tiddler.title, tiddler.modified, tiddler.modifier, \
      ' '.join(tiddler.tags), escape(tiddler.contents or 'None???')
    return result

class TiddlyMaker:
  TMPL = BASE+"/html/template.html"
  format = ClassicTiddlerFormat()
  
  def makehtml(self, pagename, url, tiddlers=[]):
    # read the html file, shove in the server side code and latest tiddler content
    # The markers are: <!--PUT XXX HERE-->, where XXX is one of: URL, PAGENAME, TIDDLERS
    data = open(self.TMPL).read()
    tiddler_data = '\n'.join(map(self.format.format_one, tiddlers))
    replacements = [
      ('URL', url),
      ('PAGENAME', pagename),
      ('TIDDLERS', tiddler_data),
    ]
    for marker, replacement in replacements:
      marker = '<!--PUT %s HERE-->' % marker
      data = data.replace(marker, replacement)
    return data

tiddlymaker = TiddlyMaker()

def find_and_create_or_update(page, title, contents, was=''):
  tiddler = find_by_title(page, was or title)
  if not tiddler:
    if was:
      raise KeyError, "Tiddler not found:"+was
    else:
      tiddler = Tiddler()
      tiddler.page = page
      tiddler.title = title
  if was:
    tiddler.title = title
  tiddler.contents = contents
  tiddler.modifier = users.get_current_user()  #!!! do we believe the web page?
  tiddler.put()
  
def find_and_delete(page, title):
  tiddler = find_by_title(page, title)
  if not tiddler:
    raise KeyError, "Tiddler not found:"+title
  tiddler.deleted = True
  tiddler.put()

def time2str(dt):
  # how tiddlywiki likes time strings
  return dt.strftime('%Y%m%d%H%M%S')

def str2time(dtstr):
  return datetime.datetime.strptime(dtstr, '%Y%m%d%H%M%S')

class TWmixin:
  "Mixin for handlers to set cookie expected by JS code"
  def set_twcreds(self):
    curuser = users.get_current_user()
    twcreds = curuser and ('%s:x' % curuser.email()) or ''
    self.request.headers['Set-Cookie'] = 'twcreds=%s; path=/' % twcreds
    
class TWHandler(TWmixin, webapp.RequestHandler): pass

############### Framework Extensions ##################
def todict(multidict): 
  """Convert multidict to a dictionary where keys are (8-bit) strings and
  values are either (unicode) strings or lists
  """ 
  d = {}
  for key, value in multidict.items():
    if isinstance(key, unicode):
      key = key.encode('utf8')
    if key in d:
      d[key] = [d[key], value]
    else:
      d[key] = value
  return d

class HtmlRequestHandler(webapp.RequestHandler):
  # dispatch get/post requests to an html method,
  # send back result from html
  def get(self):
    self.response.out.write(self.html(**todict(self.request.params)))
    
  post = get
    
  def html(self, **kw):
    return 'Override the html method!'
    
##################### Handlers ########################
HANDLERS = []

class RootHandler(TWHandler):
  """Redirects to a specific page in the public pages area"""
  def get(self):
    self.redirect('/pp/home')

HANDLERS.append(('/', RootHandler))

PP_REGEX = re.compile('/pp/(%s)$' % PAGE_REGEX)
class PublicPagesHandler(TWHandler):
  """Generates a complete HTML file"""
  def get(self):
    # pull pagename out of url
    # HACK: let logged-in users create a page just by visiting
    m = PP_REGEX.search(self.request.uri)
    if not m:
      self.error(401)
      self.response.out.write("Invalid page")
      return
    page = get_or_make_page(m.group(1))
    
    # point the JS to the "ajax" URL for internal requests.
    ajax_url = '/ajax'
    tiddlers = all_tiddlers(page)
    data = tiddlymaker.makehtml(page.name, ajax_url, tiddlers)
    self.set_twcreds()
    self.response.out.write(data)

HANDLERS.append(('/pp/'+PAGE_REGEX, PublicPagesHandler))
    
#---------------------------------------------------

class LoginHandler(TWHandler):
  """Gives link to log in, then uses JS to inform wiki app"""
  def get(self):
    curuser = users.get_current_user()
    if curuser:
      # return page to inform wiki app of success      
      self.set_twcreds()
      html = '<script>window.opener.serverSide.loggedIn(%r); window.close()</script>' % curuser.email()
      self.response.out.write(html)
    else:
      url = users.create_login_url('/login')
      self.redirect(url)

HANDLERS.append(('/login', LoginHandler))


#---------------------------------------------------

class LogoutHandler(TWHandler):
  """Gives link to log in, then uses JS to inform wiki app"""
  def get(self):
    curuser = users.get_current_user()
    if curuser:
      url = users.create_logout_url('/logout')
      self.redirect(url)
    else:
      # return page to inform wiki app of success      
      self.set_twcreds()
      html = '<script>window.opener.serverSide.loggedOut(); window.close()</script>'
      self.response.out.write(html)

HANDLERS.append(('/logout', LogoutHandler))

#---------------------------------------------------

class AjaxHandler(HtmlRequestHandler):
  """Handles parameter based saving, loading etc
  
  """
  def html(self, action=None, pagename=None, **kw):
    page = get_page(pagename)
    method = getattr(self, 'do_'+action)
    return method(page, **kw)

  def do_save(self, page, title=None, contents=None, was=None, **kw):
    #logging.info("Save content %s" % contents)
    try:
      if was == 'null': was = ''
      find_and_create_or_update(page, title, contents, was)
    except Exception, e:
      return e
    else:
      return 'saved'

  def do_delete(self, page, title=None, **kw):
    if not title:
      return 'wtf: '+str(kw.keys())
    try:
      find_and_delete(page, title)
    except Exception, e:
      return e
    else:
      return 'deleted'
      
  def do_load(self, page, since=None, **kw):
    # return tiddlers as a list of dicts in json format
    import simplejson
    result = []
    tiddlers = get_since(page, str2time(since))
    for tiddler in tiddlers:
      d = {'title': tiddler.title}
      if tiddler.deleted:
        d['deleted'] = 1
      else:
        d['text'] = tiddler.contents     
        d['modified'] = time2str(tiddler.modified)
        d['modifier'] = tiddler.modifier.email()
        d['tags'] = tiddler.tags
      result.append(d)
    return simplejson.dumps(result)

HANDLERS.append(('/ajax', AjaxHandler))
#---------------------------------------------------

################ entry point #################

def main():
  application = webapp.WSGIApplication(HANDLERS, debug=True)
  wsgiref.handlers.CGIHandler().run(application)

if __name__ == '__main__':
  main()
