import { expect } from "chai";
import { expectRejection } from "expect-rejection";

import { ChunksService, db, ProcessingService, XMLFile,
         XMLFilesService } from "wed-demo-lib";
import { CoNLLTransformService } from "../app/conll-transform.service";
import { ProcessingError } from "../app/util";

import { DataProvider } from "./util";

// Interface that shows the private members.
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
    let doc: Document;
    beforeEach(async () => {
      doc = await provider.getDoc("annotated-file-1.xml");
    });

    it("transforms a document", async () => {
      const expected = await provider.getText("annotated-file-1-converted.txt");
      const result = await rservice.transform(doc);

      const lines = result.split("\n");
      const expectedLines =
        expected.split("\n").filter(line => line[0] !== "#");

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
