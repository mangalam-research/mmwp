import "chai";
import { expectRejection } from "expect-rejection";
import "mocha";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
chai.use(sinonChai);

const expect = chai.expect;

import { ChunksService } from "dashboard/chunks.service";
import { ProcessingService } from "dashboard/processing.service";
import { db } from "dashboard/store";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { ConcordanceCleanupTransformService,
       } from "mmwp/concordance-cleanup-transform.service";
import { ProcessingError } from "mmwp/util";
import { DataProvider } from "./util";

// We use innerHTML a lot for testing purposes.
// tslint:disable:no-inner-html

// tslint:disable-next-line:max-func-body-length
describe("ConcordanceCleanupTransformService", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let service: ConcordanceCleanupTransformService;
  let bad: XMLFile;
  let malformed: XMLFile;

  after(() => db.delete().then(() => db.open()));

  before(() => {
    provider = new DataProvider("/base/test/data/concordance_cleanup_tests/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new ConcordanceCleanupTransformService(new ProcessingService(),
                                                     xmlFilesService);
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
      await service.perform(good);
      const result =
        (await xmlFilesService.getRecordByName("first-cleaned.xml"))!;

      expect(await result.getData()).to.equal(
        (await provider.getText("first-converted.xml")).trim());
    });

    it(`names the resulting files properly`, async () => {
      const results = await service.perform(good);
      expect(results[0].name).to.equal("first-cleaned.xml");
    });

    it(`saves the files`, async () => {
      expect(await xmlFilesService.getRecordByName("first-cleaned.xml"))
        .to.be.undefined;
      await service.perform(good);
      expect(await xmlFilesService.getRecordByName("first-cleaned.xml"))
        .to.not.be.undefined;
    });

    it(`raises an error if any file is going to be overwritten`, async () => {
      await service.perform(good);
      await expectRejection(service.perform(good),
                            ProcessingError,
                            /^This would overwrite: /);
    });

    it("rejects if the file is incorrect", () =>
       expectRejection(
         service.perform(bad),
         ProcessingError,
         `<p>tag not allowed here: {\"ns\":\"\",\"name\":\"div\"}<\/p>
<p>tag required: {"ns":"","name":"export"}</p>`));

    it("rejects if the file is malformed", () =>
       expectRejection(
         service.perform(malformed),
         ProcessingError,
         "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
  });
});
