const gulp = require("gulp");
const eslint = require("gulp-eslint");
const { spawn } = require("./util");

function runTslint(tsconfig, tslintConfig) {
  return spawn(
    "./node_modules/.bin/tslint",
    ["--type-check", "--project", tsconfig, "-c", tslintConfig],
    { stdio: "inherit" });
}

gulp.task("tslint-src", () => runTslint("src/tsconfig.json", "src/tslint.json"));

gulp.task("tslint-test", ["tsc", "copy-other"],
          () => runTslint("test/tsconfig.json", "test/tslint.json"));

gulp.task("tslint", ["tslint-src", "tslint-test"]);

gulp.task("eslint", () =>
          gulp.src(["src/**/*.js", "*.js", "gulptasks/**/*.js", "web/**/*.js",
                    "test/**/*.js", "!src/mmwp/internal-schemas/**/*.js"])
          .pipe(eslint())
          .pipe(eslint.format())
          .pipe(eslint.failAfterError()));

gulp.task("lint", ["eslint", "tslint"]);
