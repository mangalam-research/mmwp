/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// This is a convention we use to provide a kind of generic configuration that
// can be modified before actually configuring SystemJS. The fact is that
// SystemJS (contrarily to RequireJS) does not handle changing the baseURL.
// See: https://github.com/systemjs/systemjs/issues/1208#issuecomment-215707469
window.systemJSConfig = {
  baseURL: "lib/",
  pluginFirst: true,
  paths: {
    "npm:": "/node_modules/",
    "wed-external:": "npm:wed/standalone/lib/external/",
  },
  map: {
    "@angular/core": "npm:@angular/core",
    "@angular/common": "npm:@angular/common",
    "@angular/compiler": "npm:@angular/compiler",
    "@angular/platform-browser": "npm:@angular/platform-browser",
    "@angular/platform-browser-dynamic":
    "npm:@angular/platform-browser-dynamic",
    "@angular/http": "npm:@angular/http/bundles/http.umd.js",
    "@angular/router": "npm:@angular/router/bundles/router.umd.js",
    "@angular/forms": "npm:@angular/forms/bundles/forms.umd.js",
    rxjs: "npm:rxjs",
    jquery: "npm:jquery",
    bootstrap: "npm:bootstrap/dist/js/bootstrap.js",
    bootbox: "npm:bootbox",
    "blueimp-md5": "npm:blueimp-md5",
    dexie: "npm:dexie",
    bluebird: "npm:bluebird/js/browser/bluebird.js",
    salve: "npm:salve",
    "salve-dom": "npm:salve-dom",
    json: "npm:systemjs-plugin-json",
    slug: "npm:slug",
    bluejax: "npm:bluejax",
    "bluejax.try": "npm:bluejax.try",
    rangy: "wed-external:rangy/rangy-core",
    dashboard: "npm:wed-demo/dev/lib/dashboard",
    wed: "npm:wed/standalone/lib/wed",
  },
  meta: {
    "mmwp/internal-schemas/*": {
      loader: "json",
    },
    "npm:bootbox/*": {
      // We must add bootstrap here because bootbox does not list
      // it as a dependency.
      deps: ["bootstrap"],
    },
    "npm:bootstrap/bootstrap/*.js": {
      format: "global",
      deps: ["jquery"],
      exports: "$",
    },
  },
  packages: {
    // We use this to specify a default extension of ".js". Yep, this is enough
    // because if `defaultExtension` is not explicitly set it default to ".js"!
    "": {},
  },
  packageConfigPaths: [
    "npm:@angular/*/package.json",
    "npm:@angular/*/testing/package.json",
    "npm:*/package.json",
  ],
};

//  LocalWords:  popup onerror findandself jQuery Dubeau MPL Mangalam
//  LocalWords:  txt tei ajax jquery
