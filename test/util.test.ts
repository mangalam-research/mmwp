import "chai";
import "mocha";

const expect = chai.expect;

import { ajax } from "bluejax";
import { constructTree, Grammar, ValidationError } from "salve";
import { ErrorData } from "salve-dom";

// tslint:disable-next-line:no-require-imports
import concordance = require("mmwp/internal-schemas/concordance");
import { validate } from "mmwp/util";
import { ModeValidator } from "wed";

// tslint:disable-next-line:mocha-no-side-effect-code
const modeError = [{
      error: new ValidationError("foo"),
      node: undefined,
      index: undefined,
}];

class FakeModeValidator implements ModeValidator {
  validateDocument(): ErrorData[] {
    return modeError;
  }
}

describe("util", () => {
  let doc: Document;
  let grammar: Grammar;
  let badDoc: Document;

  before(() => {
    badDoc = new DOMParser().parseFromString("<div/>", "text/xml");
    grammar = constructTree(JSON.parse(JSON.stringify(concordance)));
    return ajax("/base/test/data/sample-concordance-1.xml")
      .then((newDoc) => doc = newDoc);
  });

  describe("validate", () => {
    it("does not report errors on valid file", async () =>
       expect(await validate(grammar, doc)).to.deep.equal([]));

    it("uses the mode validator", async () =>
       expect(await validate(grammar, doc, new FakeModeValidator()))
       .to.deep.equal(modeError));

    it("reports errors on an invalid file", async () =>
       expect(await validate(grammar, badDoc))
       .to.have.length.greaterThan(0));
  });
});
