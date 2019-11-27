import { expect } from "chai";
import { expectRejection } from "expect-rejection";
import $ from "jquery";
import sinon from "sinon";

import { ChunksService, db, XMLFile, XMLFilesService } from "wed-demo-lib";
import { ConcordanceUploadAndCleanupService,
       } from "../app/concordance-upload-and-cleanup.service";
import { ProcessingError } from "../app/util";
import { DataProvider } from "./util";

// We use innerHTML a lot for testing purposes.
// tslint:disable:no-inner-html

// tslint:disable-next-line:max-func-body-length
describe("ConcordanceUploadAndCleanupService", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let service: ConcordanceUploadAndCleanupService;
  let bad: XMLFile;
  let malformed: XMLFile;

  after(() => db.delete().then(() => db.open()));

  before(() => {
    provider = new DataProvider("/base/test/data/concordance_cleanup_tests/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new ConcordanceUploadAndCleanupService(xmlFilesService);
  });

  describe("#perform", () => {
    let good: XMLFile;

    beforeEach(async () => {
      good = await xmlFilesService.makeRecord("first.xml",
                                              provider.getText("first.xml"));
      bad = await xmlFilesService.makeRecord("foo", "<div/>");
      malformed = await xmlFilesService.makeRecord("moo", "");
    });

    // We need to reset after each test because otherwise we get overwrite
    // errors.
    afterEach(() => db.delete().then(() => db.open()));

    afterEach(() => {
      const modals = Array.from(document.querySelectorAll(".modal.show"));
      for (const modal of modals) {
        $(modal).modal("hide");
      }

      const openModal = document.querySelector(".modal.show");
      expect(openModal).to.be.null;

      sinon.restore();
    });

    it("runs without error", async () => {
      await service.process(good);
      const result =
        (await xmlFilesService.getRecordByName("first.xml"))!;

      expect(await result.getData()).to.equal(
        (await provider.getText("first-converted.xml")).trim());
    });

    it(`saves the files`, async () => {
      expect(await xmlFilesService.getRecordByName("first.xml"))
        .to.be.undefined;
      await service.process(good);
      expect(await xmlFilesService.getRecordByName("first.xml"))
        .to.not.be.undefined;
    });

    it("rejects if the file is incorrect", () =>
       expectRejection(
         service.process(bad),
         ProcessingError,
         `<p>tag not allowed here: {\"ns\":\"\",\"name\":\"div\"}<\/p>
<p>tag required: {"ns":"","name":"export"}</p>`));

    it("rejects if the file is malformed", () =>
       expectRejection(
         service.process(malformed),
         ProcessingError,
         "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
  });
});
