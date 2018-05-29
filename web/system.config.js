/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// This is a convention we use to provide a kind of generic configuration that
// can be modified before actually configuring SystemJS. The fact is that
// SystemJS (contrarily to RequireJS) does not handle changing the baseURL.
// See: https://github.com/systemjs/systemjs/issues/1208#issuecomment-215707469
/* global process */
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
    "ng-loader": "npm:wed-demo/dev/lib/systemjs-angular-loader.js",
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
    dashboard: "npm:wed-demo/prod/lib/dashboard",
    wed: "npm:wed/packed/lib/wed",
    rangy: "wed-external:rangy/rangy-core",
    log4javascript: "wed-external:log4javascript",
    "merge-options": "wed-external:merge-options",
    "is-plain-obj": "wed-external:is-plain-obj",
    ajv: "wed-external:ajv.min",
    interact: "wed-external:interact.min",
    interactjs: "wed-external:interact.min",
    "bootstrap-notify": "wed-external:bootstrap-notify",
    typeahead: "wed-external:typeahead.jquery.min",
  },
  meta: {
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

//
// For better or for worse, pooling process.env.NODE_ENV is the default. :-/
//
// Our default is to assume a production environment. So check whether we are
// in development mode.
if (typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.NODE_ENV === "development") {
  // eslint-disable-next-line prefer-destructuring
  var systemJSConfig = window.systemJSConfig;
  systemJSConfig.meta["dashboard/*"] = systemJSConfig.meta["dashboard/*/*"] = {
    loader: "ng-loader",
  };

  systemJSConfig.meta["mmwp/internal-schemas/*"] = {
    loader: "json",
  };

  systemJSConfig.map.dashboard = "npm:wed-demo/dev/lib/dashboard";
}
//  LocalWords:  popup onerror findandself jQuery Dubeau MPL Mangalam
//  LocalWords:  txt tei ajax jquery
