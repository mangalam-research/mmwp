import "chai";
import "chai-as-promised";
import "mocha";

const expect = chai.expect;

import { ChunksService } from "dashboard/chunks.service";
import { ProcessingService } from "dashboard/processing.service";
import { db } from "dashboard/store";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { CoNLLTransformService } from "mmwp/conll-transform.service";
import { ProcessingError } from "mmwp/util";
import { DataProvider } from "./util";

// Interface that shows the private members of ConcordanceTransformService.  We
// cannot link it directly to ConcordanceTransformService because revealing
// private fields is not allowed by TS.
interface RevealedService {
  transform(doc: Document): Promise<string>;
}

function revealService(s: CoNLLTransformService): RevealedService {
  // tslint:disable-next-line:no-any
  return s as any as RevealedService;
}

// tslint:disable-next-line:max-func-body-length
describe("CoNLLTransformService", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let service: CoNLLTransformService;
  let rservice: RevealedService;
  let file: XMLFile;
  let bad: XMLFile;
  let malformed: XMLFile;

  before(() => {
    provider = new DataProvider("/base/test/data/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new CoNLLTransformService(new ProcessingService());
    rservice = revealService(service);
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
       expect(service.perform(bad))
       .to.eventually.be.rejectedWith(
         ProcessingError,
         `<p>tag not allowed here: {"ns":"","name":"div"}<\/p>
<p>tag required: {"ns":"http://mangalamresearch.org/ns/mmwp/doc",\
"name":"doc"}</p>`));

    it("errors if the file is malformed", () =>
       expect(service.perform(malformed))
       .to.eventually.be.rejectedWith(
         ProcessingError,
         "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
  });

  describe("#transform", () => {
    let doc: Document;
    beforeEach(async () => {
      doc = await provider.getDoc("annotated-file-1.xml");
    });

    it("transforms a document", async () => {
      const expected = await provider.getText("annotated-file-1-converted.txt");
      const result = await rservice.transform(doc);

      const lines = result.split("\n");
      const expectedLines = expected.split("\n")
        .filter((line) => line[0] !== "#");

      for (let ix = 0; ix < lines.length; ++ix) {
        const line = lines[ix];

        expect(ix).to.be.lessThan(expectedLines.length);
        const expectedLine = expectedLines[ix];

        expect(line).to.equal(expectedLine);
      }

      expect(lines).to.have.lengthOf(expectedLines.length);
    });
  });
});
