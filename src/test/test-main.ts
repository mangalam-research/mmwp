// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import "core-js/es7/reflect";

// tslint:disable:ordered-imports
import "zone.js/dist/zone";
import "zone.js/dist/long-stack-trace-zone";
import "zone.js/dist/proxy";
import "zone.js/dist/sync-test";
import "zone.js/dist/mocha-patch";
import "zone.js/dist/async-test";
import "zone.js/dist/fake-async-test";

import * as chai from "chai";
import * as expectRejection from "expect-rejection";
import sinonChai from "sinon-chai";

expectRejection.use(chai);
chai.use(sinonChai);
chai.config.truncateThreshold = 0;

import { XMLFile, db } from "wed-demo-lib";

// It seems the very first access to Dexie is slow. So we have this before all
// hook perform a first access with a long timeout. We tried just db.open() but
// that did not work. We have to access something concrete to overcome the
// initial long access.

before(async function(): Promise<void> {
  this.timeout(10000);
  const xmlfile = new XMLFile("fnord", "a");
  await db.xmlfiles.put(xmlfile);
  await db.delete();
  await db.open();
});

// tslint:disable-next-line:no-submodule-imports
import { getTestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
// tslint:disable-next-line:no-submodule-imports
} from "@angular/platform-browser-dynamic/testing";

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

declare const require: any;

// Then we find all the tests.
const context = require.context("./", true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
