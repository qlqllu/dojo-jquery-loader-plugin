define(
[
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/string",
    "dojo/when"
], function(array, lang, Deferred, all, string, when) {

  var require,
    // the jQuery version cache
    // maps a fully-qualified jQuery URL to a cached jQuery instance
    jQueryCache = {},

    // the plugin version cache
    // maps a fully-qualified jQuery URL to a map from
    // fully-qualified jQuery plugin URLs to promises,
    // which are set to true after loading has completed
    pluginCache = {},

    // plugins must be loaded with window.$ and window.jQuery set
    // to the correct jQuery version instance
    // this object serves as a semaphore to synchronize loading
    // plugins with different jQuery versions
    semaphore = null,

    loadjQuery = function( /*String*/ jQueryURL) {
      // summary:
      //      returns a promise to return the requested version
      //      of jQuery (or the default version if not specified)
      //      jQueryCache[jQueryURL] will also be populated with
      //      the version of jQuery after the promise is fulfilled
      //
      // jQueryURL:
      //      (String) the fully-qualified jQuery URL

      var deferred;

      // set up the promise to load jQuery?
      if (jQueryCache[jQueryURL] === undefined) {

        deferred = new Deferred();

        // load the jQuery version, run noConflict(), 
        // store it in the cache and resolve the deferred
        require([jQueryURL], lang.partial(

        function(jQueryURL, deferred) {

          var jQuery = window.jQuery.noConflict(true);
          jQueryCache[jQueryURL] = jQuery;
          deferred.resolve(jQuery);
        },

        jQueryURL, deferred));

        // promise to return the jQuery object
        jQueryCache[jQueryURL] = deferred.promise;
      }

      return when(jQueryCache[jQueryURL]);
    },

    loadPlugin = function( /*String*/ jQueryURL, /*String*/ pluginURL) {
      // summary:
      //      returns a promise to load the given jQuery plugin
      //      into the jQuery object loaded from jQueryURL
      //      assumes that the appropriate jQuery version has been
      //      locked with lockjQuery() by the caller
      //
      // jQueryURL:
      //      (String) the fully-qualified jQuery URL
      //
      // pluginURL:
      //      (String) the fully-qualified plugin URL

      var cache;

      // get the plugin cache for its jQuery version
      if (pluginCache[jQueryURL] === undefined) {
        pluginCache[jQueryURL] = {};
      }
      cache = pluginCache[jQueryURL];

      // set up the promise to load the plugin?
      if (cache[pluginURL] === undefined) {
        var deferred = new Deferred();

        //load the plugin
        //because the require will cache the plugin module,
        //so, deferrent widget load the same url plugin will have problem:
        //the second widget's jquery object will not have the plugin
        require([pluginURL], lang.partial(
          function(cache, pluginURL, deferred) {
            // clear the promise out of the cache
            // and resolve the deferred
            cache[pluginURL] = true;
            deferred.resolve();
          },
          cache, pluginURL, deferred)
        );

        // promise to return the jQuery object with the
        // plugin installed
        cache[pluginURL] = deferred.promise;
      }
      return when(cache[pluginURL]);
    },

    loadPlugins = function( /*String*/ jQueryURL, /*Array*/ pluginURLs) {

      // summary:
      //      returns a promise to return a jQuery object
      //      loaded from jQueryURL and populated with
      //      all of the jQuery plugins from pluginURLs
      //
      // jQueryURL:
      //      (String) the fully-qualified jQuery URL
      //
      // pluginURLs:
      //      (Array) an array of fully-qualified jQuery plugin
      //      URL strings

      // lock the jQuery version and load the plugins
      return when(lockjQuery(jQueryURL), lang.partial(
      function(jQueryURL, pluginURLs, unlock) {
        return when(
        all(array.map(pluginURLs, function(pluginURL) {
          return loadPlugin(jQueryURL, pluginURL);
        })),
        lang.partial(
        function(jQueryURL, unlock) {
          unlock();
          return jQueryCache[jQueryURL];
        },
        jQueryURL, unlock));
      },
      jQueryURL, pluginURLs));
    },

    lockjQuery = function( /*String*/ jQueryURL) {
      // summary:
      //      returns a promise to set the global $ and jQuery
      //      values to the requested version of jQuery
      //      the promise resolves to a callback that must
      //      be invoked to unlock the global $ and jQuery values
      //
      // jQueryURL:
      //      (String) the fully-qualified jQuery URL

      return when(loadjQuery(jQueryURL), lang.partial(
      function(jQueryURL, jQuery) {
        var
        // this Deferred will help keep the requested
        // version of jQuery global until it gets resolved by
        // the unlock() callback returned by this function
        lock = new Deferred(),

          // this guarantees that the unlock() callback
          // is only executed once
          once = {
            finished: false
          };

        // set up the semaphore?
        if (semaphore === null) {
          semaphore = {
            url: jQueryURL,
            count: 1,
            finish: new Deferred(),

            // jQuery globals to restore
            $: window.$,
            jQuery: window.jQuery
          };

          // set up the jQuery globals
          window.$ = window.jQuery = jQuery;

        } else {
          // increment the semaphore or wait for the current 
          // locked version to finish?
          if (semaphore.url === jQueryURL) {
            semaphore.count += 1;
          } else {
            return when(semaphore.finish.promise, lang.partial(lockjQuery, jQueryURL));
          }
        }

        // prepare to release the lock
        when(lock, function() {
          var finish;
          // sanity check
          if (semaphore === null) {
            return;
          }
          // are we finished?
          semaphore.count -= 1;
          if (semaphore.count <= 0) {
            finish = semaphore.finish;
            window.$ = semaphore.$,
            window.jQuery = semaphore.jQuery;
            semaphore = null;

            finish.resolve();
          }
        });

        // return the unlock function
        return lang.partial(
        function(lock, once) {
          if (!once.finished) {
            lock.resolve();
          } else {
            once.finished = true;
          }
        },
        lock, once);
      },

      jQueryURL));
    },

    jRequire = function(jqueryUrl, plugins) {
      // summary:
      //      Loads a jQuery and then loads or runs each layer
      //      of jQuery plugins in sequence. As each layer
      //      is loaded or run, the global version of jQuery is set up
      //      with all previously loaded plugins.
      //
      //      The plugins will be loaded or run in sequence as all
      //      previous dependencies become available.
      //
      // jqueryUrl:
      //      (String) the jQuery url to load.
      //
      // plugins:
      //      (Array) an of array of plugin URLs, either absolute or path-relative.
      //

      // load the plugins
      return loadPlugins(jqueryUrl, plugins);
    };

  return {
    load: function(id, _require, callback){
      var parts= id.split(","), jqueryUrl, plugins = [];
      require = _require;
      if(parts.length === 0){
        callback(null);
      }else{
        jqueryUrl = parts[0];
        plugins = parts.slice(1);
        when(jRequire(jqueryUrl, plugins), callback);
      }
    }
  };
});