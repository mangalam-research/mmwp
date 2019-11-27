import { expect } from "chai";
import { expectRejection } from "expect-rejection";

import { ChunksService, db, XMLFile, XMLFilesService } from "wed-demo-lib";
import { ConcordanceCleaner } from "../app/concordance-cleaner";
import { ProcessingError } from "../app/util";
import { DataProvider } from "./util";

// We use innerHTML a lot for testing purposes.
// tslint:disable:no-inner-html

// Interface that shows the private members of
// ConcordanceCleanupTransformService.  We cannot link it directly to
// ConcordanceCleanupTransformService because revealing private fields is not
// allowed by TS.
interface RevealedCleaner {
  getRefText(line: Element): string;
  makeOutputName(name: string): string;
  cleanLine(line: Element): string;
  checkOutput(outputName: string, titleDoc: Document): Promise<void>;
}

function revealProcessor(s: ConcordanceCleaner): RevealedCleaner {
  // tslint:disable-next-line:no-any
  return s as any as RevealedCleaner;
}

describe("ConcordanceCleaner", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let proc: ConcordanceCleaner;
  let rproc: RevealedCleaner;

  describe("with overwrite false", () => {
    before(() => {
      provider = new DataProvider("/base/test/data/concordance_cleanup_tests/");
      xmlFilesService = new XMLFilesService(new ChunksService());
      proc = new ConcordanceCleaner(xmlFilesService, false);
      rproc = revealProcessor(proc);
    });

    describe("#perform", () => {
      let good: XMLFile;
      let bad: XMLFile;
      let malformed: XMLFile;

      beforeEach(async () => {
        good = await xmlFilesService.makeRecord("first.xml",
                                                provider.getText("first.xml"));
        bad = await xmlFilesService.makeRecord("foo", "<div/>");
        malformed = await xmlFilesService.makeRecord("moo", "");
      });

      // We need to reset after each test because otherwise we get overwrite
      // errors.
      afterEach(() => db.delete().then(() => db.open()));

      it("converts a document", async () => {
        const result = await proc.perform(good);
        expect(result).to.have.lengthOf(1);
        expect(await result[0].getData()).to
          .equal((await provider.getText("first-converted.xml")).trim());
      });

      it("names the resulting files properly", async () => {
        const results = await proc.perform(good);
        expect(results[0].name).to.equal("first-cleaned.xml");
      });

      it("saves the files", async () => {
        expect(await xmlFilesService.getRecordByName("first-cleaned.xml"))
          .to.be.undefined;
        await proc.perform(good);
        expect(await xmlFilesService.getRecordByName("first-cleaned.xml"))
          .to.not.be.undefined;
      });

      it("raises an error if any file is going to be overwritten", async () => {
        await proc.perform(good);
        await expectRejection(proc.perform(good),
                              ProcessingError,
                              /^This would overwrite: /);
      });

      it("rejects if the file is incorrect", () =>
         expectRejection(
           proc.perform(bad),
           ProcessingError,
           `<p>tag not allowed here: {\"ns\":\"\",\"name\":\"div\"}<\/p>
<p>tag required: {"ns":"","name":"export"}</p>`));

      it("rejects if the file is malformed", () =>
         expectRejection(
           proc.perform(malformed),
           ProcessingError,
           "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
    });

    describe("#makeOutputName", () => {
      it("adds a suffix to the base name, before the extension", () => {
        expect(rproc.makeOutputName("foo.xml")).to.equal("foo-cleaned.xml");
      });

      it("adds a suffix to the base name (no extension)", () => {
        expect(rproc.makeOutputName("foo")).to.equal("foo-cleaned");
      });
    });

    describe("#cleanLine", () => {
      let doc: Document;
      beforeEach(async () => {
        doc = await provider.getDoc("first.xml");
      });

      it("removes commas", () => {
        const line = doc.getElementsByTagName("line")[0];
        rproc.cleanLine(line);
        expect(line.innerHTML).to.equal(`
      <left><normalised a_id="lugli" orig="yāvan" auto="false">ab\
</normalised>cd<normalised a_id="lugli" orig="nīla-" auto="false">ef\
</normalised></left><kwic>gh</kwic><right>ij</right>
    `);
      });

      it("converts quotes", () => {
        const line = doc.getElementsByTagName("line")[2];
        rproc.cleanLine(line);
        expect(line.innerHTML).to.equal(`
      <left>'' <notvariant a_id="lugli">''''''''</notvariant></left>\
<kwic>''''''''</kwic><right>''a''b''c''</right>
    `);
      });

      it("does not alter @refs if it does not need changing", () => {
        const line = doc.getElementsByTagName("line")[0];
        const origRefs = line.getAttribute("refs");
        rproc.cleanLine(line);
        expect(line.getAttribute("refs")).to.equal(origRefs);
      });

      it("adds a fake sentence ID to @refs when necessary", () => {
        const line5 = doc.getElementsByTagName("line")[5];
        rproc.cleanLine(line5);
        expect(line5.getAttribute("refs")).to
          .equal("0004,50,Moo,sūtra,Mooplex,milk,pasteurized,old");

        const line4 = doc.getElementsByTagName("line")[4];
        rproc.cleanLine(line4);
        expect(line4.getAttribute("refs")).to
          .equal("0003,010|20,Moo,sūtra,Mooplex,milk,pasteurized,old");
      });
    });

    describe("#checkOutput", () => {
      let doc: Document;
      let record: XMLFile;

      before(async () => {
        record = await xmlFilesService.makeRecord("existing.xml", "qqq");
        await xmlFilesService.updateRecord(record);
      });

      after(async () => xmlFilesService.deleteRecord(record));

      beforeEach(async () => {
        doc = await provider.getDoc("first.xml");
      });

      it("raises error if would overwrite", async () => {
        await expectRejection(rproc.checkOutput("existing.xml", doc),
                              ProcessingError,
                              "This would overwrite: existing.xml");
      });

      it("raises error if the document is not valid", async () => {
        doc.documentElement.innerHTML = "";
        await expectRejection(rproc.checkOutput("non-existing.xml", doc),
                              ProcessingError);
      });

      it("no error if would not overwrite", async () => {
        await rproc.checkOutput("non-existing.xml", doc);
      });
    });

    describe("#getRefText", () => {
      let doc: Document;
      beforeEach(async () => {
        doc = await provider.getDoc("first.xml");
      });

      it("returns the ref text", () => {
        const line = doc.getElementsByTagName("line")[0];
        expect(rproc.getRefText(line)).to.equal(
          "10,010|18,Abhidharmakośabhāṣya,śāstra,Vasubandhu,abhidharma,N/A,\
classical");
      });

      it("throws if @refs is absent", () => {
        const line = doc.getElementsByTagName("line")[0];
        line.removeAttribute("refs");
        expect(() => rproc.getRefText(line)).to.throw(Error);
      });
    });
  });

  describe("with overwrite true", () => {
    before(() => {
      proc = new ConcordanceCleaner(xmlFilesService, true);
      rproc = revealProcessor(proc);
    });

    describe("#perform", () => {
      let good: XMLFile;

      beforeEach(async () => {
        good = await xmlFilesService.makeRecord("first.xml",
                                                provider.getText("first.xml"));
      });

      // We need to reset after each test because otherwise
      // we get overwrite errors.
      afterEach(() => db.delete().then(() => db.open()));

      it("runs without error", async () => {
        await proc.perform(good);
        const result = (await xmlFilesService.getRecordByName("first.xml"))!;

        expect(await result.getData()).to.equal(
          (await provider.getText("first-converted.xml")).trim());
      });

      it("names the resulting files properly", async () => {
        expect((await proc.perform(good))[0].name).to.equal("first.xml");
      });

      it("does not raise an error on overwrite", async () => {
        await proc.perform(good);
        await proc.perform(good);
      });
    });

    describe("#makeOutputName", () => {
      it("adds a suffix to the base name, before the extension", () => {
        expect(rproc.makeOutputName("foo.xml")).to.equal("foo.xml");
      });

      it("adds a suffix to the base name (no extension)", () => {
        expect(rproc.makeOutputName("foo")).to.equal("foo");
      });
    });

    describe("#checkOutput", () => {
      let doc: Document;
      let record: XMLFile;

      before(async () => {
        record = await xmlFilesService.makeRecord("existing.xml", "qqq");
        await xmlFilesService.updateRecord(record);
      });

      after(async () => xmlFilesService.deleteRecord(record));

      beforeEach(async () => {
        doc = await provider.getDoc("first.xml");
      });

      it("no error if would overwrite", async () => {
        await rproc.checkOutput("existing.xml", doc);
      });
    });
  });
});
