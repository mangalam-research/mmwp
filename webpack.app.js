"use strict";

const serveStatic = require("serve-static");

module.exports = (config) => {
  config.module.rules.unshift({
    test: /\/internal-schemas\/.*\.js$/,
    loader: "json-loader",
  });

  // devServer is defined only when running ``ng serve``. And that's the only
  // time we need to alter it.
  if (!config.devServer) {
    return config;
  }

  if (config.devServer.before) {
    throw new Error("devServer.before already set; you need to figure out how \
to merge it with yours");
  }

  config.devServer.before = (app, _server, _compiler) => {
    const baseURL = "/node_modules";
    const serve = serveStatic("./node_modules", {
      index: false,
    });
    app.use((req, resp, next) => {
      const { url } = req;
      if (!url.startsWith(baseURL)) {
        next();
        return;
      }

      req.url = url.slice(baseURL.length);
      serve(req, resp, next);
    });
  };

  return config;
};
