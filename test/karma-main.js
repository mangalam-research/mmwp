/* global Promise SystemJS */
(function main() {
  "use strict";

  // Cancel the autorun. This essentially does the magic that the RequireJS
  // adapter (and maybe the SystemJS adapter too) do behind the scenes. We call
  // window.__karma__.start later.
  window.__karma__.loaded = function loaded() {};

  var allTestFiles = [];
  var TEST_REGEXP = /test\/(?!karma-main).*\.js$/i;

  Object.keys(window.__karma__.files).forEach(function forEach(file) {
    if (TEST_REGEXP.test(file)) {
      var normalizedTestModule = file.replace(/\.js$/g, "");
      allTestFiles.push(normalizedTestModule);
    }
  });
  var config = window.systemJSConfig;
  config.baseURL = "/base/build/dev/lib/";
  config.paths["npm:"] = "/base/node_modules/";
  config.map.sinon = "npm:sinon";
  config.map["sinon-chai"] = "npm:sinon-chai";
  config.map["check-error"] = "npm:check-error/check-error.js";
  config.map.dashboard = "npm:wed-demo/dev/lib/dashboard";
  config.map.mmwp = "/base/build/dev/lib/mmwp";
  var external = "npm:wed/packed/lib/external/";
  ["merge-options",
   "bootstrap-notify",
   "is-plain-obj",
   "log4javascript"].forEach(function each(x) {
     config.map[x] = external + x + ".js";
   });
  config.map.interactjs = external + "interact.min.js";
  config.map.ajv = external + "ajv.min.js";
  config.map.typeahead = external + "typeahead.jquery.min.js";
  SystemJS.config(config);

  // These are preloaded by Karma as scripts that leak into the global space.
  SystemJS.amdDefine("mocha.js", [], {});
  SystemJS.amdDefine("chai.js", [], {});

  function importIt(file) {
    return SystemJS.import(file);
  }

  return Promise.all(["bootbox",
                      "@angular/core/testing",
                      "@angular/platform-browser-dynamic/testing"]
                     .map(importIt))
    .then(function loaded(deps) {
      var bootbox = deps[0];
      var testing = deps[1];
      var browser = deps[2];

      // Disable animations to help simplify tests.
      bootbox.setDefaults({ animate: false });

      // This is needed so that the testbed is properly initialized.
      testing.TestBed.initTestEnvironment(browser.BrowserDynamicTestingModule,
                                          browser.platformBrowserDynamicTesting());

      return Promise.all(allTestFiles.reverse().map(importIt));
    })
    .then(window.__karma__.start);
}());
