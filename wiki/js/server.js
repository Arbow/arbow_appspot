// See http://ziddlywiki.com/forum#CommentPlugin 
// Moved to javascript because of conflicts with serverside.js or newer TW

config.CommentPlugin = {
  // "true" or "false"...
  fold_comments: true,
  default_fold: false
};

function taglist(tags) {
  return (typeof tags == 'string') ? tags.readBracketedList() : tags || [];
}

function get_parent(tiddler){
  var tags;
  orig_title = tiddler.title;
  while(tiddler && (tags = taglist(tiddler.tags)).contains('comments')) 
    tiddler = store.fetchTiddler(tags[0]);
  return tiddler;
}
function count_comments(tiddler){
  var tagged=store.getTaggedTiddlers(tiddler.title);
  var count=0;
  for(var i=0; i<tagged.length; i++) {
    if (tagged[i].tags.contains('comments')) { 
      count++;
      count += count_comments(tagged[i])
    }
  }
  return count
}

CommentPlugin = {
  initialize: function () {
    this.installShadow();
    this.installMacros();
    this.installCommands();

    // now called directly by serverside.saveTiddler
    //TiddlyWiki.prototype.CommentPlugin_saveTiddler = TiddlyWiki.prototype.saveTiddler
    //TiddlyWiki.prototype.saveTiddler = this.saveTiddler
  },
  installCommands: function() {
    config.commands.saveComment = {}
    merge(config.commands.saveComment, config.commands.saveTiddler)
  },
  installMacros: function() {
    config.macros.newCommentLink = {
      label: 'New Comment Here...',
      prompt: 'Create a new comment tiddler associated with this tiddler',
      handler: this.newCommentLinkHandler
    };
    config.macros.comments = {
      dateFormat: 'DD MMM YYYY hh:0mm',
      handler: this.comments_handler
    };
  },
  installShadow: function() {
    // note: not used directly
    config.shadowTiddlers.CommentEditTemplate="<div class='toolbar' macro='toolbar +saveComment -cancelTiddler deleteTiddler wikibar'></div><div class='title' macro='view title'></div><div class='editor' macro='edit tags' style='display:none;'></div><div class='GuestSign' >Your Name: <span macro='option txtUserName'></span>(NickName)<br />Comments：</div><div class='editor' macro='edit text'></div>"
    COMMENT_EDIT_TEMPLATE = config.tiddlerTemplates.length;  
    config.tiddlerTemplates[COMMENT_EDIT_TEMPLATE]="CommentEditTemplate"

    config.shadowTiddlers.ViewTemplate += "\n<div class='comments' macro='comments'></div>";
    //??? notify?

    this.installStyles();
  },
  installStyles: function() {
    // Install the CSS to show the comments nicely. When the user has thier 
    // own user-modified StyleSheetLayout, this will have no effect and there will
    // be no warning.

    var css  = '/**** inserted by Comments.js ****/'
    css += '.commentTags ul{\n'
    css += '\tlist-style:none; \n'
    css += '\tpadding-left:0px;\n'
    css += '\tmargin: 0 0 3px 0;\n'
    css += '} \n'
    css += '.commentTags li {\n'
    css += '\tdisplay:inline;color:#999;\n'
    css += '} \n'
    css += '.commentTags li a.button{\n'
    css += '\tcolor:#999;\n'
    css += '} \n'
    css += '.comment{\n'
    css += '\tborder-left:1px solid #ccc; margin-top:10px; margin-left:10px;\n'
    css += 'padding:5px;\n'
    css += '} \n'
    css += '.newCommentLink{\n'
    css += '\tpadding-top:10px\n'
    css += '} \n'
    css += '.tagging, .selected .tagging, .tiddler .tagging{\n'
    css += '\tdisplay:none;\n'
    css += '} \n'
    css += '.comment a.button{\n'
    css += '\tpadding:0px; font-size:smaller;\n'
    css += '}\n'
    
    // stick the CSS on the end of StyleSheetLayout. Put inside /*}}}*/ if present.
    var shadow = config.shadowTiddlers.StyleSheetLayout;
    if (shadow.indexOf('/*}}}*/') > -1)
       css = shadow.replace('/*}}}*/', css + '/*}}}*/')
    else
       css = shadow + css
    config.shadowTiddlers.StyleSheetLayout = css

    // ensure the styles take effect
    store.notify('StyleSheetLayout', true)
  },
  canComment: function(tiddler) { 
    // override/replace this as needed
    return true;
  },
  newCommentLinkHandler: function(place,macroName,params,wikifier,paramString,tiddler) {
    if(tiddler && store.tiddlerExists(tiddler.title) && CommentPlugin.canComment(tiddler)) {
      var onclick = function(e) {
        if (!e) var e = window.event;
	var theTarget = resolveTarget(e);
        var title = tiddler.title;
        if (title.indexOf(' Comment ')>-1) 
          title = title.split(' Comment ')[0];
        title += ' Comment ' + (new Date()).formatString('YYYY-0MM-0DD 0hh:0mm:0ss');
        var comment = store.createTiddler(title);
        comment.text = '';
        comment.tags = [tiddler.title, 'comments', 'excludeLists'];
        story.displayTiddler(theTarget, title, "CommentEditTemplate");
        story.focusTiddler(title,"text");
        return false;
      }
      createTiddlyButton(place, this.label, this.prompt, onclick);
    }
  },
  comments_handler: function(place,macroName,params,wikifier,paramString,tiddler) {
    if(tiddler.title=='comments') return;
    var comments = store.getTaggedTiddlers(tiddler.title, 'created');

    if(comments.length>0 && !tiddler.tags.contains('comments') 
       && config.CommentPlugin.fold_comments) {
      var show = createTiddlyElement(place, 'p');
      show.innerHTML = '<a href="#" onclick="var e=document.getElementById(\'comments'+tiddler.title+'\');e.style.display=e.style.display==\'block\'?\'none\':\'block\';return false;">Comments ('+count_comments(tiddler)+') &raquo;</a>';
    }

    var place = createTiddlyElement(place, 'div', 'comments'+tiddler.title, 'comments');
    if(comments.length>0 && !tiddler.tags.contains('comments') 
       && config.CommentPlugin.fold_comments && config.CommentPlugin.default_fold)
      place.style.display = 'none';
    else
      place.style.display = 'block';
    for(var i=0; i<comments.length; i++) {
      if(!comments[i].tags.contains('comments')) continue;
      var container = createTiddlyElement(place, 'div', null, 'comment');
      var title = createTiddlyElement(container, 'strong');
      var link = createTiddlyLink(title, comments[i].modifier, true);
      createTiddlyElement(title, 'span', null, null, ', '+comments[i].created.formatString(this.dateFormat));
      if(comments[i].modifier == config.options.txtUserName) {
        createTiddlyElement(title, 'span', null, null, ' (');
        var edit = createTiddlyLink(title, comments[i].title);
        edit.innerHTML = 'edit';
        createTiddlyElement(title, 'span', null, null, ')');
      }
      createTiddlyElement(container, 'br');
      config.macros.tiddler.handler(container, "tiddler", null, null, '[['+comments[i].title+']]');
      createTiddlyElement(container, 'br');
      config.macros.comments.handler(container,null,null,null,null,comments[i]);
    }
    config.macros.newCommentLink.handler(place,null,null,null,null,tiddler);
  },
  closeTiddlers: [],
  saveTiddler: function(title,newTitle,newBody,modifier,modified,tags) {
    var t = this.CommentPlugin_saveTiddler(title,newTitle,newBody,modifier,modified,tags);
    CommentPlugin.saveTiddlerHook(t,title,newTitle,newBody,modifier,modified,tags);
    return t;
  },
  saveTiddlerHook: function(t,title,newTitle,newBody,modifier,modified,tags) {
    // ensure tags is a list
    var tags = (typeof tags == 'string' ? tags.readBracketedList() : tags || []);
    if(tags.contains('comments')) {
      var original = config.CommentPlugin.default_fold;
      config.CommentPlugin.default_fold = false;
      parent = get_parent(t)
      if (parent) {
        story.refreshTiddler(parent.title, DEFAULT_VIEW_TEMPLATE, true);

        // !!! these should be done in saveComment command
        CommentPlugin.closeTiddlers.push(newTitle);
        setTimeout("story.closeTiddler(CommentPlugin.closeTiddlers.pop(), true)", 1000);
      }
      config.CommentPlugin.default_fold = original;
    }
  }
}
// the serverSide instance/object installs the necessary hooks into
// TiddlyWiki and provides the UI for informing the user. It does not 
// communicate to any server -- that is up to another object (provided 
// to the install function)
//
// serverSide provides a login link through the <<serverside>> macro. At the
// current time the <<serverside>> macro can support multiple submacros to
// flexible use of the login link, logout button and pull from server
// button. In the future more UI elements may be needed, ie, registration,
// server status, server settings.  There is only one macro to avoid
// proliferation and use of old macros in tiddlers.
//
// serverSide works to ensure <<serverside login>> is viewable by default --
// it will appear in the sidebar or in a visible shadowed tiddler
//
// serverSide restricts toolbar buttons when not logged in according to its
// permissionModel
//
// serverSide also provides a <<serverside pull>> macro to pull updated
// content -- ie for a back-and-forth conversation
//
var serverSide = {
  install: function(serverComm) {
    this.comm = serverComm
    this.permissions = new PermissionModel(this.permissionRules)
    this.installEverything()
  },
  installEverything: function() {
    this.installNotify()
    this.installMacros()
    this.installToolbarOverride()
    this.installSideBarLogin()
    this.installRestrictedEditing()
    this.installSaveValidation()
  },
  installNotify: function() {
    config.notifyTiddlers.push({name: null, notify: this.onChange})

    // ack -- notifyAll skips blanket notifications :(
    config.notifyTiddlers.push({name: "serverside dummy", notify: this.onChange})

  },
  installMacros: function() {
    config.macros.serverside = {
      handler: this.serversidemacrohandler,
      submacros: {},
      defaultparams: ['login', 'logout', 'pull', 'push']
    }

    submacros = config.macros.serverside.submacros
    submacros.login = {
      label: "login",
      handler: this.loginmacrohandler
    }
    submacros.logout = {
      label: "logout",
      handler: this.logoutmacrohandler
    }
    submacros.pull = {
      label: "pull from server",
      handler: this.pullmacrohandler
    }
    submacros.push = {
      label: "push to the server",
      handler: this.pushmacrohandler
    }
  },
  startedUp: false,
  startUp: function() {
    // called after all of the tiddlers have been loaded
    if (!this.startedUp) {
      this.startedUp = true
      this.initializeExtraData()
      this.comm.startUp()
      this.checkSideBarLogin()
      if (CommentPlugin) CommentPlugin.initialize()
    }
  },

  // create a place to store extra info about each tiddler
  // at a minimum, a dirty flag per tiddler. existence of 
  // a clean/dirty flag helps determine whether the tiddler 
  // existed for long enough to be a true rename
  initializeExtraData: function() {
    var title
    var extra = this.extra = {}
    store.forEachTiddler(function (title, tiddler) {
      extra[title] = {dirty: 0}
    })
  },
  installSideBarLogin: function() {
    opts = config.shadowTiddlers.SideBarOptions
    if (opts.indexOf('<<serverside') == -1) {
      config.shadowTiddlers.SideBarOptions = '<<serverside>>' + opts
    } else {
      dbg_alert('<<serverside>> already installed:'+opts) // maybe in a new version
    }
    config.shadowTiddlers.ServerSideLogin = 'The {{{<<serverside>>}}} macro is necessary to allow you to log in. Please install it in SideBarOptions (or elsewhere). You can see/interact with it here:\n\n<<serverside>>'
  },
  checkSideBarLogin: function() {
    if (!this.loginmacrocalled) {
      // the user doesnt have the opportunity to login. 
      // we could shove <<serverside>> into SideBarOptions but
      // that would confuse the issue of who edited SideBarOptions
      story.displayTiddler(null,'ServerSideLogin')
    }
  },   
  serversidemacrohandler: function(place,macroName,theParams) {
    // show the submacros as determined by params
    var params = theParams
    if (!params.length) params = this.defaultparams
    for (var i = 0; i < params.length; i++) {
      param = params[i]
      submacro = this.submacros[param]
      if (submacro) {
        submacro.handler(place, param, [])
      }
    }
  },
  loginmacrocalled: false,
  loginmacrohandler: function(place,macroName,params) {
    // make a popup link to the login URL
    // unless we are already logged in
    serverSide.loginmacrocalled = true

    function clickHandler(e) {      
      serverSide.authenticate({
        what: 'login',
      })
      return false;
    }

    var loginDiv = createTiddlyElement(place,"div","LoginFields")
    if (serverSide.amLoggedIn) loginDiv.setAttribute('style', 'display: none;')

    var btn = createTiddlyButton(loginDiv,this.label,this.prompt,clickHandler)
    btn.setAttribute("style", "display: block;") // hack so the fields line up
  },
  logoutmacrohandler: function(place,macroName,params) {
    // make a button to logout
    function clickHandler(e) {
      //??? what should the api be?
      serverSide.authenticate({what: 'guest'})
      return false;
    }

    var btn = createTiddlyButton(place,this.label,this.prompt,clickHandler)
  },
  pullmacrohandler: function(place,macroName,params) {
    // make a link for user initiated server-pulls
    function clickHandler(e) {
      serverSide.comm.pull()
    }

    var btn = createTiddlyButton(place,this.label,this.prompt,clickHandler)
  },
  pushmacrohandler: function(place,macroName,params) {
    // make a link for user initiated server-push
    function clickHandler(e) {
      serverSide.comm.push()
    }

    var btn = createTiddlyButton(place,this.label,this.prompt,clickHandler)
  },

  onChange: function(title) {
    // this function hooks into the store's notification system.
    // we get notified in several situations
    tiddler = store.getTiddler(title)
    if (serverSide.updating) {
      // we are updating, see if the visible tiddler needs refreshing
      story.refreshTiddler(title,tiddler.template,1)
    } else if (title == "serverside dummy") {
      // notifyAll called 
      serverSide.startUp()
    } else if (tiddler) {
      // not a deletion
      // done elsewhere, called unexpectedly after creation of new tiddler
    } else if (title) {
      // deletion
    } else {
      // notifyAll called -- startup
      serverSide.startUp()
    }
  },  

  /*********** callbacks from serverComm *************/
  dirtiness: 0,
  dataSafe: function() {
    if (--this.dirtiness <= 0) store.dirty = false
  },
  dataUnsafe: function() {
    this.dirtiness++
  },
  status: function(message) {
    // the server is telling us something
    //
    // this API is temporary. a better api would allow
    // situations like, saving, save done, to show up as icons
    // or other elements of the UI
    displayMessage(message, null)
  },
  authenticate: function(params) { 
    serverSide.comm.authenticate(params)
  },
  loggedOut: function() {
    serverSide.amLoggedIn = false
    elt = document.getElementById('LoginFields')
    elt.style.display = 'block' //appears to work no matter how many logins are shown
    serverSide.refreshToolbars()
  },
  loggedIn: function(username) {
    // hide the login fields
    // show the logged in text
    if (this.startedUp) displayMessage('Login Successful')
    config.options.txtUserName = username
    elt = document.getElementById('LoginFields')
    if (elt) elt.style.display = 'none' //appears to work no matter how many logins are shown
    serverSide.amLoggedIn = true
    serverSide.refreshToolbars()
  },
  amLoggedIn: false,
  firsttime: 0,
  updating: 0,
  updates: function(newinfoarray) {
    // the server is telling us tiddlers have changed
    // we get an array of {title: ... text: ... tags: ...}
    // or {title: ... deleted: 1}
    serverSide.updating++
    try {
      serverSide.processUpdates(newinfoarray)
    } catch (e) {
      displayMessage("Error processing updates: " + e);
      serverSide.updating--
      throw(e);
    }
    serverSide.updating--
  },
  processUpdates: function(newinfoarray) {
    for (var i=0; i<newinfoarray.length; i++) {
      newinfo = newinfoarray[i]
      title = newinfo.title
      if (newinfo.deleted) {
        if (store.tiddlerExists(title)) {
          story.closeTiddler(title,true,0);
          store.deleteTiddler(title);
          store.notify(title,true);
        }
      } else {
        tiddler = store.tiddlerExists(title) ? store.getTiddler(title) : store.createTiddler(title)
        try { 
           modified = Date.convertFromYYYYMMDDHHMM(newinfo.modified) 
        } catch(e) { 
           alert(e+":"+newinfo.modified); modified=undefined; 
        }
        store.saveTiddler(title,title,newinfo.text,config.options.txtUserName,modified,newinfo.tags)
        store.notify(title)
      }
      story.refreshAllTiddlers();
    }
    if (this.firsttime) {
      // makes a pull where we are far out of sync work better
      story.closeAllTiddlers()
      restart()
      serverSide.firsttime = 0
    }
  },
  installToolbarOverride: function() {
    // needed so we can get the command 'name' from the command object
    for (c in config.commands) {
      config.commands[c].name = c
    }

    // override the createCommand function in the toolbar
    config.macros.toolbar._createCommand = config.macros.toolbar.createCommand;
    config.macros.toolbar.createCommand = function(place,command,tiddler,theClass) {
      if (serverSide.checkToolbarCommand(command, tiddler)) {
        config.macros.toolbar._createCommand(place,command,tiddler,theClass)
      }
    }
  },
  checkToolbarCommand: function(command, tiddler) {
    var name = (typeof command == "string") ? command : command.name;    
    var what = this.restrictedToolbarCommands[name]
    if (what == undefined) return true
    return this.permissions.can(this._who(tiddler), what, tiddler)
  },
  _who: function(tiddler) { 
    // maybe one day, return 'owner'
    return this.amLoggedIn ? 'user' : 'guest'
  },
  checkEditTags: function(tiddler) {
    return this.permissions.can(this._who(tiddler), 'edittags', tiddler)
  },
  restrictedToolbarCommands: { // map toolbar commands to an action name
    editTiddler: 'edit', 
    deleteTiddler: 'delete',
    saveTiddler: 'edit',
    saveComment: 'comment'
  },
  refreshToolbars: function() {
    // the toolbars need updating
    // force-refresh all tiddlers
    story.forEachTiddler(function(title,tiddler) {
      story.refreshTiddler(title,tiddler.template,1)
     })
  },
  installRestrictedEditing: function() {
    config.options.chkHttpReadOnly = false;
    if (CommentPlugin) {
      CommentPlugin.canComment = function(tiddler) {
        return serverSide.permissions.can(serverSide._who(tiddler), 'comment', tiddler)
      }
    }
    config.shadowTiddlers.NoTagsEditTemplate = "<div class='toolbar' macro='toolbar +saveTiddler -cancelTiddler deleteTiddler'></div>\n<div class='title' macro='view title'></div>\n<div class='editor' macro='edit title'></div>\n<div class='editor' macro='edit text'></div>\n<div macro='tags'></div>"
    Story.prototype._chooseTemplateForTiddler = Story.prototype.chooseTemplateForTiddler;
    Story.prototype.chooseTemplateForTiddler = function(title,template) {
      template = this._chooseTemplateForTiddler(title,template)
      if (template == 'EditTemplate' && !serverSide.checkEditTags(store.getTiddler(title))) {
        return 'NoTagsEditTemplate'
      } else {
        return template
      }
    }
  },
  installSaveValidation: function() {
    // alters the saveTiddler function in two ways:
    // 1. sets oldtitle if the title has changed
    // 2. calls hooks to check title, tags, etc.
    TiddlyWiki.prototype._saveTiddler = TiddlyWiki.prototype.saveTiddler
    TiddlyWiki.prototype.saveTiddler = function(title,newTitle,newBody,modifier,modified,tags) {
      // Perform some pre-save validation. After save, update the server and
      // CommentsPlugin While serverSide is processing, avoid the steps
      // above, as this function is called to populate the store with data
      // from the server.
      
      // ensure tags is a list -- could be passed as null or a sting
      tags = (typeof tags == 'string' ? tags.readBracketedList() : tags || []);
      if (!serverSide.updating) {
        newTitle = serverSide.validateTitle(title, newTitle)
        tags = serverSide.validateTags(tags)
      }
      tiddler = this._saveTiddler(title,newTitle,newBody,modifier,modified,tags);
      if (CommentPlugin)
        CommentPlugin.saveTiddlerHook(tiddler, title, newTitle, newBody, modifier, modified, tags);
      if (!serverSide.updating) {
        serverSide.save(tiddler, title)
      }
      return tiddler;
    }
    
    TiddlyWiki.prototype._removeTiddler = TiddlyWiki.prototype.removeTiddler
    TiddlyWiki.prototype.removeTiddler = function(title) {
      this._removeTiddler(title)
      serverSide.remove(title)
    }
  },  
  save: function(tiddler, oldtitle) {
    displayMessage('save: '+tiddler.title);
    this.dataUnsafe()    
    var e = this.extra[oldtitle]
    //displayMessage('e:'+e+' o:'+oldtitle+' t:'+tiddler.title)
    if (!e) {
      // tiddler is new - oldtitle meaningless
      oldtitle = null
      e = this.extra[tiddler.title] = {dirty: 1}
    }
    if (oldtitle == tiddler.title) {
      oldtitle = null
    }
    serverSide.comm.save(tiddler, oldtitle)
  },
  remove: function(title) {
    delete this.extra[title]
    serverSide.dataUnsafe()
    serverSide.comm.del(title)
  },
  validateTitle: function(oldTitle, newTitle) {
    if (oldTitle != newTitle && this.extra[oldTitle]) {
      return this.validateTitleChange(oldTitle, newTitle)
    } else {
      return newTitle
    }
  },
  validateTitleChange: function(oldTitle, newTitle) {
    return newTitle
  },
  validateTags: function(tags) {
    // tags is a list. return the same
    // force guests to have a tag, 'guest_edit'
    // don't allow guests to set either 'restricted' or 'systemTiddlers' or 'systemConfig'
    if (this.amLoggedIn) 
       return tags

    var result = []
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i]
      if (this.tagRestricted(tag)) continue
      result.pushUnique(tag)
    }
    if (this._who(tiddler) == 'guest')
      result.pushUnique('guest_edit')
    return result
  },
  tagRestricted: function(tag) {
    return this.restrictedTags.contains(tag)
  },
  restrictedTags: ['restricted', 'systemTiddlers', 'systemConfig', 'nodelete'],
  permissionRules: [
    // guests can edit/delete everything except shadow tiddlers or system tiddlers
    //{who: 'guest', tags: 'systemTiddlers', result: false}, 
    //{who: 'guest', state: 'shadow', result: false},

    // A set of permissions to let guests edit a small part of the wiki
    {who:'guest', what: ['edittags'], result: false},
    {who:'guest', what: 'edit', tags: 'unrestricted', result: true},
    {who:'guest', what: 'comment', result: true},
    //{who:'guest', what: 'edit', state:'missing', result: true},
    {who:'guest', what: ['edit','delete'], result: false}

    // A set of permissions to let guests edit a small part of the wiki
    //{who:'guest', what: 'delete', tags: 'nodelete', result: false},
    //{who:'guest', state: 'shadow', result: false},
    //{who:'guest', what: 'edittags', tags: ['systemTiddlers', 'systemConfig', 'restricted', 'nodelete'], result: false},
    //{who:'guest', tags: ['systemTiddlers', 'systemConfig', 'restricted'], result: false},
  ]
}

// permission model object
// based on patterns, eg: [
// {who:'guest', what:['edit', 'save', 'delete'], result:false}
// ]
// pattern attributes -- not present/null/empty list matches all
//   who: a role or list of roles -- 'guest', 'user'
//   what: an action or list of actions -- ie, 'edit', 'delete', 'edittags', 'comment'
//   title: a tidder title or list of tiddler titles
//   tags: a tag or list of tiddler tags
//   check: a function taking pattern, who, what, tiddler
//   calc: a function taking pattern, who, what, tiddler returning result
//   result: true or false
function PermissionModel(patterns) {
  this.patterns = patterns
  this.defaultResult = true
}
PermissionModel.prototype.can = function(who, what, tiddler) {
  var can = this.defaultResult
  for (var i = 0; i < this.patterns.length; i++) {
    var pattern = this.patterns[i]
    if (this.pattern_matches(pattern, who, what, tiddler)) {
      can = this.pattern_result(pattern, who, what, tiddler)
      dbg_alert(can)
      break
    }
  }
  dbg_alert('can(' + who + ',' + what + ',' + (tiddler&&tiddler.title) + ') -> ' + can)
  return can
}
PermissionModel.prototype.pattern_matches = function(pattern, who, what, tiddler) {
  var result
  if (pattern.check)
    result = pattern.check(pattern, who, what, tiddler)
  else
    result = this.default_check(pattern, who, what, tiddler)
  //dbg_alert('matches('+who+','+what+','+(tiddler&&tiddler.title)+'):' + pattern.toString() + ' -> ' + result)
  return result
}
PermissionModel.prototype.pattern_result = function(pattern, who, what, tiddler) {
  if (pattern.calc)
    return pattern.calc(pattern, who, what, tiddler)
  else
    return this.default_calc(pattern, who, what, tiddler)
}
PermissionModel.prototype.default_check = function(pattern, who, what, tiddler) {
  // do a quick exit if there is no match
  if (pattern.who && !this.match_value(pattern.who, who)) return false
  if (pattern.what && !this.match_value(pattern.what, what)) return false
  if (pattern.state && !this.match_value(pattern.state, this.tiddler_state(tiddler))) return false
  if (pattern.title && tiddler && !this.match_value(pattern.title, tiddler.title)) return false
  if (pattern.tags && tiddler && !this.match_list(pattern.tags, tiddler.tags)) return false
  return true
}
PermissionModel.prototype.default_calc = function(pattern, who, what, tiddler) {
  return pattern.result
}
PermissionModel.prototype.match_value = function(matcher, value) {
  // allow 'list' to be a string, a list, or an object
  if (matcher.length == undefined) {
    // an object
    return matcher[value] != undefined
  } else if (matcher.find) {
    // an array
    return matcher.find(value) != null 
  } else {
    // a string
    return matcher == value
  }
}
PermissionModel.prototype.match_list = function(matcher, vlist) {
  for (var i = 0; i < vlist.length; i++) {
    if (this.match_value(matcher, vlist[i])) { 
      return true 
    }
  }
  return false
}
PermissionModel.prototype.tiddler_state = function(tiddler) {
  if (!tiddler) return 'missing'
  var title = tiddler.title
  if(store.tiddlerExists(title)) {
    return 'exists'
  } else if(typeof config.shadowTiddlers[title] == "string") {
    return 'shadow'
  } else {
    return 'missing'
  }
}

config.options.chkAlerts = 0
function dbg_alert(msg) {
  if (config.options.chkAlerts) config.options.chkAlerts = confirm(msg)
}


Array.prototype.joinBracketedList = function() {
  var result = []
  for (var i = 0; i < this.length; i++) {
    var tag = this[i]
    if (tag.indexOf(' ') != null) tag = '[['+tag+']]'
    result.pushUnique(tag)
  }
  return result.join(' ')
}
// this object implements a dummy/example API for communicating with 
// a server. this object avoids doing its own UI or fiddling with 
// the internals of TiddlyWiki. The serverSide object expects to be 
// called back (using status)
var simpleServer = {
  initialize: function(url, pagename) {
    this.url = url ? url : window.location.href+''
    this.ajaxServer = new AjaxFactory(url, {pagename: pagename})
  },
  startUp: function() {
    this.calcMarker()
    this.authenticate({'what':'check'})
    //this.pull()
  },
  marker: null,
  calcMarker: function() {
    // calculate the maximum 'modified' for all tiddlers    
    store.forEachTiddler(function (title, tiddler) {
      var modified = tiddler.modified.convertToYYYYMMDDHHMM()
      if (simpleServer.marker < modified) simpleServer.marker = modified
    })
  },
  save: function(tiddler, oldTitle) {
    // no status expectations
    simpleServer.ajaxServer.POSTparams({
         action:'save',
         title: tiddler.title,
         was: oldTitle,
         contents: tiddler.text,
         modifier: tiddler.modifier,
         tags: tiddler.tags.joinBracketedList()},
       simpleServer.alertIfNot('saved'))
  },
  del: function(title) {
    // status could be called with 'authok' or 'authfailed' or 'badcall'
    simpleServer.ajaxServer.POSTparams({
       action:'delete', 
       title:title},
     simpleServer.alertIfNot('deleted'))
  },
  authenticate: function(params) {
    // params should be:
    //   {'what': 'check'}
    //     check cookie/contact server to see if we are logged in
    ////   {'what': 'login', 'username': ..., 'password': ...}
    //   {'what': 'login'}
    //     pop up window to the login URL    
    //   {'what': 'guest'}
    //     remove credentials
    //   Pie in the sky stuff
    //   {'what': 'register', 'username', 'email'}
    //     status could be called with ...
    //   {'what': 'visitor', 'name', 'email'}
    //     status could be called with ...

    if (params['what'] == 'check') {
      // look for a specially named cookie
      cookie = GetCookie('twcreds')
      if (cookie) { 
        serverSide.loggedIn(cookie.split(':')[0]) 
      }
    } else if (params['what'] == 'guest') {
      window.open('/logout', 'loginwin', 'width=500,height=450,scrollable=yes,resizable=yes')
    } else if (params['what'] == 'login') {
      window.open('/login', 'loginwin', 'width=500,height=450,scrollable=yes,resizable=yes')
    }      
  },
  parseLogin: function(data) {
    if (data == 'success') {
      serverSide.loggedIn(simpleServer._username)
    } else {
      displayMessage(data.substring(0,100))
    }
  },
  alertIfNot: function(ifnot) {
    return function (alertstr) {
      if (alertstr == ifnot) {
        serverSide.dataSafe()
      } else {
        serverSide.status('failed: expected='+ifnot+' got='+alertstr.substring(0, 200))
      }
    }
  },
  pull: function() {
    // pull new tiddlers since the marker
    simpleServer.ajaxServer.GET({
        action:'load',
        since:simpleServer.marker},
       simpleServer.parseLoad)
  },
  push: function() {
    // push all tiddlers to the server
    // server should only accept new tiddlers
    var data = []
    store.forEachTiddler(function (title, tiddler) {
      data.push({
        title: tiddler.title,
        text: tiddler.text,
        modifier: tiddler.modified,
        tags: tiddler.tags.joinBracketedList(),
        created: tiddler.created
      })
    })
    simpleServer.ajaxServer.POSTparams({
        action:'push',
        data: JSON.stringify(data)
       }, simpleServer.alertIfNot('success'))
  },
  parseLoad: function(json) {
    // we expect a JSON array
    try {
      updates = eval(json)
    } catch(e) { // catch syntax errors
      displayMessage(e+';'+json);
      return
    }
    displayMessage(updates.length+' updates since '+simpleServer.marker)
    serverSide.updates(updates)
  }
}

// ---------------------------------------------------------------------------------
// Server Saving Code
// ---------------------------------------------------------------------------------

function urlEncode(url, params) {
  pos = url.lastIndexOf('#')
  if (pos >= 0) url = url.substring(0, pos)
  amp = (url ? (url.indexOf('?') >= 0 ? '&' : '?') : '')
  for (i in params) {
    url += amp + i + '=' + escape(params[i])
    amp = '&'
  }
  return url
}
function AjaxFactory(url, params) {
  this.baseurl = url
  this.params = params
  this.url = urlEncode(url, params);
  this.GET = function (params, callback) {
    url = urlEncode(this.url,  params)
    return new AjaxReq('GET', url, true, null, null, callback)
  }
  this.POSTparams = function (params, callback) {
    data = urlEncode(urlEncode('?', this.params), params)
    //displayMessage('POST '+this.baseurl);
    //displayMessage(data.substring(0,100));
    return new AjaxReq('POST', this.baseurl, true,
      'application/x-www-form-urlencoded',
      data,
      callback)
  }
}
// creates an AjaxReq object with its own response object
function AjaxReq(
    method, url, 
    async,
    content_type, 
    requestbody,
    callbackfunc) {
  // from http://www.webpasties.com/xmlHttpRequest/
  var xmlhttp;
  /*@cc_on
  @if (@_jscript_version >= 5)
    try {
      xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
    } catch (e) {
      try {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
      } catch (E) {
        xmlhttp = false;
      }
    }
  @else
  xmlhttp = false;
  @end @*/
  if (!xmlhttp && typeof XMLHttpRequest != 'undefined') {
    try {
      xmlhttp = new XMLHttpRequest();
    } catch (e) {
      xmlhttp = false;
    }
  }

  this.http = xmlhttp;

  // start the request 
  this.http.open(method, url, async)
  this.http.onreadystatechange = function () {
    if (xmlhttp.readyState == 4) {
      callbackfunc(xmlhttp.responseText)
    }
  }
  // make headers and trailing newlines
  this.http.setRequestHeader('Content-type', content_type)
  this.http.send(requestbody)
}

// This code is copied from an example from MSDN.
// Retrieve the value of the cookie with the specified name.
function GetCookie(sName)
{
  // cookies are separated by semicolons
  var aCookie = document.cookie.split("; ");
  for (var i=0; i < aCookie.length; i++)
  {
    // a name/value pair (a crumb) is separated by an equal sign
    var aCrumb = aCookie[i].split("=");
    if (sName == aCrumb[0]) 
      return unescape(aCrumb[1]);
  }

  // a cookie with the requested name does not exist
  return null;
}

function DelCookie(sName)
{
  document.cookie = sName + "=; expires=Fri, 31 Dec 1999 23:59:59 GMT;";
}


// mini/ajax.js - http://timmorgan.org/mini

function $(e){if(typeof e=='string')e=document.getElementById(e);return e};
function collect(a,f){var n=[];for(var i=0;i<a.length;i++){var v=f(a[i]);if(v!=null)n.push(v)}return n};

ajax={};
ajax.x=function(){try{return new ActiveXObject('Msxml2.XMLHTTP')}catch(e){try{return new ActiveXObject('Microsoft.XMLHTTP')}catch(e){return new XMLHttpRequest()}}};
ajax.serialize=function(f){var g=function(n){return f.getElementsByTagName(n)};var nv=function(e){if(e.name)return encodeURIComponent(e.name)+'='+encodeURIComponent(e.value);else return ''};var i=collect(g('input'),function(i){if((i.type!='radio'&&i.type!='checkbox')||i.checked)return nv(i)});var s=collect(g('select'),nv);var t=collect(g('textarea'),nv);return i.concat(s).concat(t).join('&');};
ajax.send=function(u,f,m,a){var x=ajax.x();x.open(m,u,true);x.onreadystatechange=function(){if(x.readyState==4)f(x.responseText)};if(m=='POST')x.setRequestHeader('Content-type','application/x-www-form-urlencoded');x.send(a)};
ajax.get=function(url,func){ajax.send(url,func,'GET')};
ajax.gets=function(url){var x=ajax.x();x.open('GET',url,false);x.send(null);return x.responseText};
ajax.post=function(url,func,args){ajax.send(url,func,'POST',args)};
ajax.update=function(url,elm){var e=$(elm);var f=function(r){e.innerHTML=r};ajax.get(url,f)};
ajax.submit=function(url,elm,frm){var e=$(elm);var f=function(r){e.innerHTML=r};ajax.post(url,f,ajax.serialize(frm))};
/*
Copyright (c) 2005 JSON.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The Software shall be used for Good, not Evil.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
    The global object JSON contains two methods.

    JSON.stringify(value) takes a JavaScript value and produces a JSON text.
    The value must not be cyclical.

    JSON.parse(text) takes a JSON text and produces a JavaScript value. It will
    throw a 'JSONError' exception if there is an error.
*/
var JSON = {
    copyright: '(c)2005 JSON.org',
    license: 'http://www.crockford.com/JSON/license.html',
/*
    Stringify a JavaScript value, producing a JSON text.
*/
    stringify: function (v) {
        var a = [];

/*
    Emit a string.
*/
        function e(s) {
            a[a.length] = s;
        }

/*
    Convert a value.
*/
        function g(x) {
            var c, i, l, v;

            switch (typeof x) {
            case 'object':
                if (x) {
                    if (x instanceof Array) {
                        e('[');
                        l = a.length;
                        for (i = 0; i < x.length; i += 1) {
                            v = x[i];
                            if (typeof v != 'undefined' &&
                                    typeof v != 'function') {
                                if (l < a.length) {
                                    e(',');
                                }
                                g(v);
                            }
                        }
                        e(']');
                        return;
                    } else if (typeof x.toString != 'undefined') {
                        e('{');
                        l = a.length;
                        for (i in x) {
                            v = x[i];
                            if (x.hasOwnProperty(i) &&
                                    typeof v != 'undefined' &&
                                    typeof v != 'function') {
                                if (l < a.length) {
                                    e(',');
                                }
                                g(i);
                                e(':');
                                g(v);
                            }
                        }
                        return e('}');
                    }
                }
                e('null');
                return;
            case 'number':
                e(isFinite(x) ? +x : 'null');
                return;
            case 'string':
                l = x.length;
                e('"');
                for (i = 0; i < l; i += 1) {
                    c = x.charAt(i);
                    if (c >= ' ') {
                        if (c == '\\' || c == '"') {
                            e('\\');
                        }
                        e(c);
                    } else {
                        switch (c) {
                        case '\b':
                            e('\\b');
                            break;
                        case '\f':
                            e('\\f');
                            break;
                        case '\n':
                            e('\\n');
                            break;
                        case '\r':
                            e('\\r');
                            break;
                        case '\t':
                            e('\\t');
                            break;
                        default:
                            c = c.charCodeAt();
                            e('\\u00' + Math.floor(c / 16).toString(16) +
                                (c % 16).toString(16));
                        }
                    }
                }
                e('"');
                return;
            case 'boolean':
                e(String(x));
                return;
            default:
                e('null');
                return;
            }
        }
        g(v);
        return a.join('');
    },
/*
    Parse a JSON text, producing a JavaScript value.
*/
    parse: function (text) {
        return (/^(\s+|[,:{}\[\]]|"(\\["\\\/bfnrtu]|[^\x00-\x1f"\\]+)*"|-?\d+(\.\d*)?([eE][+-]?\d+)?|true|false|null)+$/.test(text)) &&
            eval('(' + text + ')');
    }
};
