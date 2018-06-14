/* global __dirname */

"use strict";

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const convertPathsToAliases = require("convert-tsconfig-paths-to-webpack-aliases").default;

const tsconfigPath = "./src/tsconfig.json";
const tsconfigDir = path.dirname(tsconfigPath);

// eslint-disable-next-line import/no-dynamic-require
const tsconfig = require(tsconfigPath);

const sourceDir = "./build/aot/";

const commonExternals = {};
["jquery", "bootstrap", "dexie",
 // The mode service needs to load this dynamically.,
 "wed/mode-map",
 // Wed is loaded by util.ts.
 "wed"]
  .forEach((name) => {
    commonExternals[name] = name;
  });

const mainBundleExternals = { ...commonExternals };
 // This needs to be loaded by the kitchen sink.
["dashboard/store"].forEach((name) => {
  mainBundleExternals[name] = name;
});

function createMakeExternals(mapping) {
  return function makeExternals(context, request, callback) {
    // If the request is relative to the module it is in, we want to turn it
    // into something relative to our sourceDir. This allows handling a request
    // to "./store" made in a module located in "dashboard/" the same as a
    // request to "dashboard/store" made from outside dashboard.
    if (request[0] === ".") {
      request = path.relative(sourceDir, path.join(context, request));
    }

    if (request in mapping) {
      callback(null, mapping[request]);
      return;
    }

    callback();
  };
}

const common = {
  context: path.join(__dirname),
  resolve: {
    modules: [sourceDir, "node_modules"],
    alias: convertPathsToAliases(tsconfig, tsconfigDir),
  },
  devtool: "source-map",
  output: {
    path: path.join(__dirname, "build/prod/lib/"),
    filename: "[name].js",
    chunkFilename: "[id].chunk.js",
    // This is a bit strange but it works. The chunks are put in build/prod/lib,
    // but the page to load is in build/prod/lib/dashboard. By default the
    // chunks are loaded relative to the page, and without a path prefix so the
    // browser would look for them in build/prod/lib/dashboard. With "../" it
    // looks one directory up.
    publicPath: "../",
    sourceMapFilename: "[name].map.js",
    libraryTarget: "amd",
  },
};

module.exports = [{
  ...common,
  mode: "production",
  entry: {
    mmwp: ["production.js", "mmwp-aot.js"],
  },
  module: {
    rules: [{
      test: /^.*\.js$/,
      loader: "ng-router-loader",
      options: {
        // Must be true to avoid using the compiler at runtime.
        aot: true,
        // We must use ``bySymbol: false`` to avoid using ngsummary files, which
        // contain hardcoded absolute paths, and thus are useless for something
        // like wed-demo, installed in ``node_modules``.
        bySymbol: false,
      },
    }, {
      test: /\/mmwp\/internal-schemas\/.*\.js$/,
      loader: "json-loader",
    }],
  },
  externals: createMakeExternals(mainBundleExternals),
  plugins: [
    new CopyWebpackPlugin([{
      from: {
        glob: "mmwp/index.html",
      },
      context: "build/dev/lib",
      transform: content =>
        content.toString()
      // Remove the script that sets environment to development.
        .replace(
          /<script data-script-type="set-environment"[^]*?>[^]*?<\/script>/,
          ""),
    }, ...["{kitchen-sink,global-config,wed-store,system.config,\
requirejs-local-config}.js",
           "*.html"].map(x => ({
             from: {
               glob: x,
             },
             context: "build/dev/lib",
           }))]),
    new webpack.ContextReplacementPlugin(
      // The (\\|\/) piece accounts for path separators in *nix and Windows
        /angular(\\|\/)core(\\|\/)@angular/,
      path.join(__dirname, "./src")),
    //
    // The way our code is currently laid out. It is not useful to use
    // this plugin. Reassess if the code is significantly changed.
    //
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: "commons",
    // }),
  ],
}, {
  ...common,
  mode: "production",
  resolve: {
    modules: [sourceDir, "node_modules"],
    alias: {
      wed: path.join(__dirname, "node_modules/wed/standalone/lib/wed"),
      "merge-options": path.join(__dirname, "node_modules/wed/standalone/lib/external/merge-options"),
      "is-plain-obj": path.join(__dirname, "node_modules/wed/standalone/lib/external/is-plain-obj"),
    },
  },
  entry: {
    "mmwp/mmwpa-mode/mmwpa-mode": ["mmwp/mmwpa-mode/mmwpa-mode.js"],
  },
  module: {},
  externals: (() => {
    const fn = createMakeExternals(mainBundleExternals);
    return (context, request, callback) => {
      if (request === "require") {
        callback(null, "require");
        return;
      }

      fn(context, request, callback);
    };
  })(),
  plugins: [
    new CopyWebpackPlugin([{
      from: {
        glob: "mmwp/mmwpa-mode/mmwpa-mode.css",
      },
      context: "build/dev/lib/",
    }]),
    new webpack.ProvidePlugin({
      platformRequire: "require",
    }),
  ],
}];
