"use strict";

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
// const convertPathsToAliases = require("convert-tsconfig-paths-to-webpack-aliases").default;

const sourceDir = "./src";

const commonExternals = {};
["jquery", "bootstrap", "dexie",
 // The mode service needs to load this dynamically.,
 "wed/mode-map",
 // Wed is loaded by util.ts.
 "wed"]
  .forEach((name) => {
    commonExternals[name] = name;
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

module.exports = [{
  context: path.join(__dirname),
  mode: "production",
  devtool: "source-map",
  output: {
    path: path.join(__dirname, "build/mmwpa-mode"),
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
  resolve: {
    modules: [sourceDir, "node_modules"],
    extensions: [".js", ".ts"],
    alias: {
      wed: path.join(__dirname, "node_modules/wed-demo-lib/wed/lib/wed"),
    },
  },
  entry: {
    "mmwpa-mode": ["app/mmwpa-mode/mmwpa-mode.ts"],
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: [{
        loader: "ts-loader",
        options: {
          configFile: "src/tsconfig.mode.json",
          compilerOptions: {
            outDir: "build/mmwpa-mode",
          },
        },
      }],
    }],
  },
  externals: (() => {
    const fn = createMakeExternals(commonExternals);
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
        glob: "src/app/mmwpa-mode/mmwpa-mode.css",
      },
      context: "dist/mmwp/mmwpa-mode",
    }]),
    new webpack.ProvidePlugin({
      platformRequire: "require",
    }),
  ],
}];
