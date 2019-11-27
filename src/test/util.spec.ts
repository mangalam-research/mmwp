import { expect } from "chai";

import { Grammar, readTreeFromJSON, ValidationError } from "salve";
import { ErrorData } from "salve-dom";

import { ModeValidator } from "wed";
// tslint:disable-next-line:import-spacing
import concordanceAnyVersion from
"../app/internal-schemas/concordance-any-version";
import { validate } from "../app/util";

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
    grammar = readTreeFromJSON(JSON.parse(JSON.stringify(concordanceAnyVersion)));
    const text =
      await (await fetch("/base/test/data/multiple-titles-v2-1.xml")).text();
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
