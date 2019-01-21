import "chai";
import "mocha";

const expect = chai.expect;

import { Grammar, readTreeFromJSON, ValidationError } from "salve";
import { ErrorData } from "salve-dom";

// tslint:disable-next-line:no-require-imports
import concordanceV1 = require("mmwp/internal-schemas/concordance-v1");
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

  before(async () => {
    const parser = new DOMParser();
    badDoc = parser.parseFromString("<div/>", "text/xml");
    grammar = readTreeFromJSON(JSON.parse(JSON.stringify(concordanceV1)));
    const text =
      await (await fetch("/base/test/data/sample-concordance-v1-1.xml")).text();
    doc = parser.parseFromString(text, "text/xml");
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
