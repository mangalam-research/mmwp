/* global module */
"use strict";
module.exports = {
  port: 8888,
  files: ["./build/**/*.{html,htm,css,js}"],
  startPath: "/build/prod/lib/mmwp/index.html",
  server: {
    baseDir: ".",
  },
};
