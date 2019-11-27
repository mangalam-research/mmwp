"use strict";

const path = require("path");

module.exports = (config) => {
  config.set({
    basePath: "",
    frameworks: ["mocha", "@angular-devkit/build-angular"],
    plugins: [
      "karma-*",
       // eslint-disable-next-line global-require
      require("@angular-devkit/build-angular/plugins/karma"),
    ],
    files: [
      { pattern: "test/data/**", included: false },
    ],
    coverageIstanbulReporter: {
      dir: path.join(__dirname, "../coverage"),
      reports: ["html", "lcovonly"],
      fixWebpackSourcePaths: true,
    },
    reporters: ["mocha"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ["ChromeHeadless"],
    singleRun: false,
  });
};
