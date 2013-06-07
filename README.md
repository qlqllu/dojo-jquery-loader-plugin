dojo-jquery-loader-plugin
===========
A dojo AMD loader plugin for loading jQuery.
If you want to use jquery in your dojo project, this loader plugin can help you to load the jquery and jquery plugin to your dojo AMD module.
Different module can load different jquery version.

##Usage
* Put jquery-loader.js into your module package
* In your module define dependencies, the code like this:
```javascript
define(['jquery-loader!path-to-jquery, path-to-jqueryplugin'], function($){});
```
The path is the same as the module path, can be absolute path, relative path, or module name.
You can load jquery plugins also, seperated by comma.


