import { expect } from "chai";

import { ValidationError } from "salve";

import { MMWPAValidator } from "../../app/mmwpa-mode/mmwpa-validator";
import { DataProvider } from "../util";

describe("MMWPAValidator", () => {
  let provider: DataProvider;
  let parser: DOMParser;

  before(() => {
    parser = new DOMParser();
    provider = new DataProvider("/base/test/data/");
  });

  it("reports a compounded bit requiring an absent next sibling", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="1">foo-</word></s></cit>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        "word is compounded with next but is at end of sentence: foo-"),
      node: document.getElementsByTagName("s")[0],
      index: 0,
    }]);
  });

  it("reports a compounded bit requiring a compounded next sibling", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="1">foo-</word><word id="2">bar</word></s></cit>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        "word is compounded with next but next word is not compounded: foo-"),
      node: document.getElementsByTagName("s")[0],
      index: 0,
    }]);
  });

  it("reports a compounded bit requiring an absent previous sibling", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="1">-foo</word></s></cit>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        "word is compounded with previous but is at start of sentence: -foo"),
      node: document.getElementsByTagName("s")[0],
      index: 0,
    }]);
  });

  it("reports a compounded bit requiring a compounded previous sibling", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="1">foo</word><word id="2">-bar</word>\
</s></cit>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        `word is compounded with previous but previous word is not \
compounded: -bar`),
      node: document.getElementsByTagName("s")[0],
      index: 1,
    }]);
  });

  it("reports duplicate ids on words", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="2">foo</word><word id="2">bar</word></s></cit>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    const s = document.getElementsByTagName("s")[0];
    // The duplicate id is reported twice because we have two dependency trees.
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        `duplicate id 2`),
      node: s,
      index: 1,
    }, {
      error: new ValidationError(
        `duplicate id 2`),
      node: s,
      index: 1,
    }]);
  });

  it("checks the dependency tree", () => {
    const document = parser.parseFromString(`\
<cit id="1"><s><word id="1" lem="blah" dep.rel="listed.with" \
conc.rel="blah">foo</word>\
<word id="2" lem="q" dep.rel="listed.with" \
conc.rel="blah" dep.head="3" conc.head="3">bar</word>\
<word id="3" lem="q">bar</word>\
</s></cit>`, "text/xml");
    const v = new MMWPAValidator(document);
    const s = document.getElementsByTagName("s")[0];
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        "word 1 has conc.rel but is not part of the conc tree"),
      node: s,
      index: 0,
    }, {
      error: new ValidationError(
        "word 1 has dep.rel but is not part of the dep tree"),
      node: s,
      index: 0,
    }]);
  });

  it("reports duplicate ids on cit", () => {
    const document = parser.parseFromString(`\
<doc><cit id="1"></cit><cit id="1"></cit></doc>\
`,
                                            "text/xml");
    const v = new MMWPAValidator(document);
    const doc = document.getElementsByTagName("doc")[0];
    expect(v.validateDocument()).to.deep.equal([{
      error: new ValidationError(
        "duplicate citation id: 1"),
      node: doc,
      index: 1,
    }]);
  });

  it("reports no errors on good file", () =>
     provider.getText("annotated-file-1.xml").then(data => {
       const document = parser.parseFromString(data, "text/xml");
       const v = new MMWPAValidator(document);
       expect(v.validateDocument()).to.have.lengthOf(0);
     }));
});
