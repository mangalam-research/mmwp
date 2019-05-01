import "chai";
import { expectRejection } from "expect-rejection";
import "mocha";

const expect = chai.expect;

import { ChunksService } from "dashboard/chunks.service";
import { ProcessingService } from "dashboard/processing.service";
import { db } from "dashboard/store";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { SemanticInformationTransformService,
         Tuple } from "mmwp/semantic-information-transform.service";
import { ProcessingError } from "mmwp/util";

import { DataProvider } from "./util";

// tslint:disable-next-line:max-func-body-length
describe("SemanticInformationTransformService", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let service: SemanticInformationTransformService;
  let file: XMLFile;
  let bad: XMLFile;
  let malformed: XMLFile;

  before(() => {
    provider = new DataProvider("/base/test/data/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new SemanticInformationTransformService(new ProcessingService());
  });

  after(() => db.delete().then(() => db.open()));

  describe("#perform", () => {
    beforeEach(async () => {
      const data = await provider.getText("annotated-file-1.xml");
      file = await xmlFilesService.makeRecord("foo", data);
      bad = await xmlFilesService.makeRecord("foo", "<div/>");
      malformed = await xmlFilesService.makeRecord("foo", "");
    });

    it("converts a file", () => service.perform(file));

    it("errors if the file is invalid", () =>
       expectRejection(
         service.perform(bad),
         ProcessingError,
         `<p>tag not allowed here: {"ns":"","name":"div"}<\/p>
<p>tag required: {"ns":"http://mangalamresearch.org/ns/mmwp/doc",\
"name":"doc"}</p>`));

    it("errors if the file is malformed", () =>
       expectRejection(
         service.perform(malformed),
         ProcessingError,
         "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
  });

  describe("#transform", () => {
    it("transforms", async () => {
      const [doc, expected] =
        await Promise.all([provider.getDoc("semantic-info-test1.xml"),
                           provider.getText("semantic-info-test1-output.xml")]);

      const result = await service.transform(doc);

      const lines = result.split("\n");
      const expectedLines =
        expected.split("\n").filter(line => line[0] !== "#");

      for (let ix = 0; ix < lines.length; ++ix) {
        const line = lines[ix];

        expect(ix).to.be.lessThan(expectedLines.length);
        // We drop the leading space, as it is not relevant.
        const expectedLine = expectedLines[ix].replace(/^\s+/, "");

        expect(line, `at line ${ix}`).to.equal(expectedLine);
      }

      expect(lines).to.have.lengthOf(expectedLines.length);
    });
  });
});

describe("'semantic-information-transform.service'.Tuple", () => {
  let blank: Tuple;
  let variants: Tuple[];

  before(() => {
    blank = new Tuple("", "", "");
    variants = [new Tuple("x", "b", "c"),
                new Tuple("a", "x", "c"),
                new Tuple("a", "b", "x")];
  });

  describe("#key", () => {
    it("is equal for tuples that are the same", () => {
      expect(blank.key).to.equal(new Tuple("", "", "").key);
      expect(new Tuple("a", "b", "c").key)
        .to.equal(new Tuple("a", "b", "c").key);
    });

    it("is unequal for tuples that are different", () => {
      expect(new Tuple("", "x", "").key)
        .to.not.equal(new Tuple("", "", "").key);
      expect(variants.map(x => x.key))
        .to.not.include(new Tuple("a", "b", "c").key);
    });
  });

  describe("#equal", () => {
    it("returns true for tuples that are equal", () => {
      expect(blank.equal(new Tuple("", "", ""))).to.be.true;
      expect(new Tuple("a", "b", "c").equal(new Tuple("a", "b", "c")))
        .to.be.true;
    });

    it("returns false for tuples that are unequal", () => {
      expect(new Tuple("", "x", "").equal(new Tuple("", "", ""))).to.be.false;
      const abc = new Tuple("a", "b", "c");
      for (const tuple of variants) {
        expect(tuple.equal(abc)).to.be.false;
      }
    });
  });

  describe("#compare", () => {
    it("returns 0 for tuples that are equal", () => {
      expect(blank.compare(new Tuple("", "", ""))).to.equal(0);
      expect(new Tuple("a", "b", "c").compare(new Tuple("a", "b", "c")))
        .to.equal(0);
      const a = new Tuple("a", "b", "c");
      const b = new Tuple("a", "b", "c");
      a.frequency = 2;
      b.frequency = 2;
      expect(a.compare(b)).to.equal(0);
    });

    it("returns -1 if this should come before other due to lemma", () => {
      const a =  new Tuple("a", "b", "c");
      const b = new Tuple("b", "b", "c");
      expect(a.compare(b)).to.equal(-1);
    });

    it("returns -1 if this should come before other due to frequency", () => {
      const a =  new Tuple("a", "b", "c");
      const a2 = new Tuple("a", "b", "c");
      a2.frequency = 10;
      expect(a2.compare(a)).to.equal(-1);
    });

    it("returns 1 if this should come after other due to lemma", () => {
      const a =  new Tuple("a", "b", "c");
      const b = new Tuple("b", "b", "c");
      expect(b.compare(a)).to.equal(1);
    });

    it("returns 1 if this should come after other due to frequency", () => {
      const a =  new Tuple("a", "b", "c");
      const a2 = new Tuple("a", "b", "c");
      a2.frequency = 10;
      expect(a.compare(a2)).to.equal(1);
    });
  });
});
