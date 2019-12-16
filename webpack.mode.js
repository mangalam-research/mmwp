"use strict";

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const sourceDir = "./src";

module.exports = {
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
  externals: {
    require: "require",
    wed: "wed",
  },
  plugins: [
    new CopyWebpackPlugin([{
      from: {
        glob: "mmwpa-mode.css",
      },
      to: ".",
      context: "src/app/mmwpa-mode/",
    }]),
    new webpack.ProvidePlugin({
      platformRequire: "require",
    }),
  ],
};
