const gulp = require("gulp");
const gulpNewer = require("gulp-newer");
const rename = require("gulp-rename");
const Promise = require("bluebird");
const path = require("path");
const requireDir = require("require-dir");
const replace = require("gulp-replace");
const argparse = require("argparse");
const config = require("./config");
const { del, fs, newer, exec, execFileAndReport, spawn, mkdirpAsync } =
      require("./util");
const { execFile } = require("child-process-promise");

const { ArgumentParser } = argparse;

// Try to load local configuration options.
let localConfig = {};
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  localConfig = require("../gulp.local");
}
catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") {
    throw e;
  }
}

const parser = new ArgumentParser({ addHelp: true });

// eslint-disable-next-line guard-for-in
for (const prop in config.optionDefinitions) {
  const optionOptions = config.optionDefinitions[prop];
  const localOverride = localConfig[prop];
  if (localOverride !== undefined) {
    optionOptions.defaultValue = localOverride;
  }

  const optionName = prop.replace(/_/g, "-");
  parser.addArgument([`--${optionName}`], optionOptions);
}

// We have this here so that the help message is more useful than
// without. At the same time, this positional argument is not
// *required*.
parser.addArgument(["target"], {
  help: "Target to execute.",
  nargs: "?",
  defaultValue: "default",
});

const options = config.options = parser.parseArgs(process.argv.slice(2));

// We purposely import the files there at this point so that the
// configuration is set once and for all before they execute. Doing
// this allows having code that depends on the configuration values.
requireDir(".");

function tsc(tsconfigPath, dest) {
  return execFileAndReport("./node_modules/.bin/tsc", ["-p", tsconfigPath,
                                                       "--outDir", dest]);
}

// The web part depends on the results of compiling wed.
gulp.task("tsc", () => tsc("src/tsconfig.json", "build/dev/lib"));

gulp.task("copy-package-info", () => {
  const dest = "build/";
  return gulp.src(
    [
      "package.json",
      "README.md",
    ],
    { base: "." })
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task("copy-other",
          () => gulp.src(["web/**/*.{js,html,css}",
                          "node_modules/wed-demo/dev/lib/kitchen-sink.js",
                          "src/**/*.{js,html,css,d.ts}"])
          .pipe(gulp.dest("build/dev/lib/")));

gulp.task("copy-html",
          () => gulp.src(["node_modules/wed-demo/dev/lib/kitchen-sink.html"])
          .pipe(replace(
            /(<script data-script-type="set-environment".*?>)/,
            `$1
process.env.DASHBOARD_BASE = "/node_modules/wed-demo/dev/lib/dashboard";
`))
          .pipe(gulp.dest("build/dev/lib/")));

gulp.task("build-dev", ["tsc", "copy-other", "copy-package-info"]);

gulp.task("ngc", () =>
          execFileAndReport("./node_modules/.bin/ngc",
                            ["-p", "src/tsconfig-aot.json"]));

gulp.task("create-aot-main", () =>
          gulp.src("src/mmwp.ts")
          .pipe(replace("AppModule", "AppModuleNgFactory"))
          .pipe(replace("app.module", "app.module.ngfactory"))
          .pipe(replace("bootstrapModule", "bootstrapModuleFactory"))
          .pipe(rename("mmwp-aot.ts"))
          .pipe(gulp.dest("build/aot/")));

gulp.task("tsc-aot", ["ngc", "create-aot-main"],
          () => tsc("tsconfig-prod.json", "build/aot-interm"));

gulp.task("copy-aot", () => gulp.src("src/mmwp/internal-schemas/**/*")
          .pipe(gulp.dest("build/aot-compiled/mmwp/internal-schemas")));

gulp.task("build-aot", ["tsc-aot", "copy-aot"]);

gulp.task("combine-aot", ["tsc-aot"],
          () => gulp.src(["src/**/*.{html,js,css}",
                          "build/aot/**/*.json",
                          "build/aot-interm/build/aot/**/*",
                          "build/aot-interm/src/**/*"])
          .pipe(gulp.dest("build/aot-compiled")));

gulp.task("build-aot-compiled", ["combine-aot"]);

gulp.task("webpack", ["build-aot-compiled", "copy-other"], () =>
          execFileAndReport("./node_modules/.bin/webpack", ["--color"]));

gulp.task("build-prod", ["webpack"]);

gulp.task("build-info", Promise.coroutine(function *task() {
  const dest = "build/dev/lib/build-info.js";
  const isNewer = yield newer(["lib/**", "!**/*_flymake.*"], dest);
  if (!isNewer) {
    return;
  }

  yield mkdirpAsync(path.dirname(dest));

  yield exec("node misc/generate_build_info.js --unclean " +
             `--module > ${dest}`);
}));

gulp.task("default", ["build-dev"]);

//
// Spawning a process due to this:
//
// https://github.com/TypeStrong/ts-node/issues/286
//
function runKarma(localOptions) {
  // We cannot let it be set to ``null`` or ``undefined``.
  if (options.browsers) {
    localOptions = localOptions.concat("--browsers", options.browsers);
  }
  return spawn("./node_modules/.bin/karma", localOptions, { stdio: "inherit" });
}

gulp.task("test-karma", ["build-dev"],
          () => runKarma(["start", "--single-run"]));

gulp.task("test", ["test-karma", "tslint", "eslint"]);

let packname;
gulp.task("pack", ["test", "build-prod"],
  () => execFile("npm", ["pack", "."], { cwd: "build" })
    .then((result) => {
      packname = result.stdout.trim();
    }));

gulp.task("pack-notest", ["default"],
          () => execFile("npm", ["pack", "."], { cwd: "build" }));

gulp.task("install-test", ["pack"], Promise.coroutine(function *install() {
  const testDir = "build/install_dir";
  yield del(testDir);
  yield fs.mkdirAsync(testDir);
  yield fs.mkdirAsync(path.join(testDir, "node_modules"));
  yield execFile("npm", ["install", `../${packname}`], { cwd: testDir });
  yield del(testDir);
}));

gulp.task("publish", ["install-test"],
          () => execFile("npm", ["publish", packname], { cwd: "build" }));

gulp.task("clean", () => del(["build", "*.html"]));

gulp.task("distclean", ["clean"],
          () => del(["downloads", "node_modules"]));

gulp.task("watch-web", () => {
  gulp.watch(["src/**/*", "web/**/*"], ["karma"]);
});
