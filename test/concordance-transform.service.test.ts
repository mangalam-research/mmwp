import "chai";
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
import { ConcordanceTransformService, Logger,
         ProcessingError } from "mmwp/concordance-transform.service";
import { DataProvider, expectReject } from "./util";

// We use innerHTML a lot for testing purposes.
// tslint:disable:no-inner-html

// tslint:disable:no-any
type Title = any;
// tslint:enable:no-any

// Interface that shows the private members of ConcordanceTransformService.  We
// cannot link it directly to ConcordanceTransformService because revealing
// private fields is not allowed by TS.
interface RevealedService {
  gatherTitles(doc: Document, titles: Record<string, Title>,
               titleToLines: Record<string, Element[]>,
               logger: Logger): void;
  transformTitle(lemma: string, titleInfo: Title, lines: Element[],
                 logger: Logger): Document | null;
  checkCit(cit: Element, logger: Logger): void;
  makeCitFromLine(title: Title, doc: Document, line: Element, citId: number,
                  logger: Logger): { cit: Element; tr: Element };
  convertMarkedToWord(doc: Document, cit: Element): void;
  cleanText(node: Node): void;
  breakIntoWords(doc: Document, cit: Element): void;
  cleanDashes(cit: Element, line: Element): void;
  populateLem(cit: Element): void;
  extractRef(text: string): string | null;
}

function revealService(s: ConcordanceTransformService): RevealedService {
  // tslint:disable-next-line:no-any
  return s as any as RevealedService;
}

function addErrantAvagraha(doc: Document): void {
  const line = doc.getElementsByTagName("line")[0];
  line.appendChild(doc.createTextNode("' "));
}

// tslint:disable-next-line:max-func-body-length
describe("ConcordanceTransformService", () => {
  let provider: DataProvider;
  let xmlFilesService: XMLFilesService;
  let service: ConcordanceTransformService;
  let file: XMLFile;
  let bad: XMLFile;
  let malformed: XMLFile;
  let refErrorDocument: XMLFile;
  let rservice: RevealedService;

  before(() => {
    provider = new DataProvider("/base/test/data/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new ConcordanceTransformService(new ProcessingService(),
                                              xmlFilesService);
    rservice = revealService(service);
  });

  after(() => db.delete().then(() => db.open()));

  describe("#perform", () => {
    const resultNames = [
      // tslint:disable-next-line:max-line-length
      "Abhidharmakośabhāṣya_word_sajn_and_word_sajni_and_word_sajnak_1029_0_0_1_within_lessdoc_titleAbhidharmakosabhaya_greater_154_51_51_buddhsktnewton_2.xml",
      // tslint:disable-next-line:max-line-length
      "Moo_word_sajn_and_word_sajni_and_word_sajnak_1029_0_0_1_within_lessdoc_titleAbhidharmakosabhaya_greater_154_51_51_buddhsktnewton_2.xml",
    ];

    function getAllFiles(): Promise<(XMLFile | undefined)[]> {
      return Promise.all(
        resultNames.map((name) => xmlFilesService.getRecordByName(name)));
    }

    beforeEach(async () => {
      file = await xmlFilesService.makeRecord(
        "foo",
        provider.getText("multiple-titles-1.xml"));

      refErrorDocument = await xmlFilesService.makeRecord(
        "foo",
        provider.getText("ref-errors.xml"));

      bad = await xmlFilesService.makeRecord("foo", "<div/>");

      malformed = await xmlFilesService.makeRecord("moo", "");
    });

    // We need to reset after each test because otherwise
    // we get overwrite errors.
    afterEach(() => db.delete().then(() => db.open()));

    afterEach(() => {
      const modals = Array.from(document.querySelectorAll(".modal.in"));
      for (const modal of modals) {
        $(modal).modal("hide");
      }

      const openModal = document.querySelector(".modal.in");
      expect(openModal).to.be.null;

      sinon.restore();
    });

    it("runs without error", async () => {
      await service.perform(file);
      const files = await getAllFiles();

      const datas = await Promise.all(files.map((x) => x!.getData()));

      // We check the cit/@ref of in all files due to the complexity of the code
      // that generates them.
      const refRegExp = /<cit .*?>/g;
      expect(datas[0].match(refRegExp)).to.deep.equal(
        ["<cit id=\"1\" ref=\"010|18\">",
         "<cit id=\"2\">"]);
      expect(datas[1].match(refRegExp)).to.deep.equal(
        ["<cit id=\"1\">",
         "<cit id=\"2\" ref=\"010|20\">",
         "<cit id=\"3\" ref=\"12.34\">"]);
    });

    it("names the resulting files properly", () =>
      service.perform(file).then((results) => {
        expect(results.map((x) => x.name))
          .to.have.members(resultNames);
      }));

    it("saves the files", async () => {
      expect(await getAllFiles()).to.deep.equal([undefined, undefined]);
      await service.perform(file);
      expect(await getAllFiles()).to.not.include(undefined);
    });

    it("raises an error if any file is going to be overwritten", async () => {
      await service.perform(file);
      await expectReject(service.perform(file), ProcessingError,
                         /^This would overwrite: /);
    });

    it("rejects if the file is incorrect", async () => {
      await expectReject(
        service.perform(bad),
        ProcessingError,
        `<p>tag not allowed here: {\"ns\":\"\",\"name\":\"div\"}<\/p>
<p>tag required: {\"ns\":\"\",\"name\":\"concordance\"}</p>`);
    });

    it("rejects if the file is malformed", () =>
       expectReject(
        service.perform(malformed),
        ProcessingError,
        "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));

    it("reports ref errors", async () => {
      await expectReject(service.perform(refErrorDocument),
                         ProcessingError,
                         new RegExp(
                           `^<p>invalid line: line without a ref: <line>
      <left_context><normalised a_id="lugli" orig="yāvan" auto="false">(.|\n)*
<p>invalid ref:`));
      const title = document.querySelector(".modal.in .modal-title");
      expect(title).to.have.property("textContent").equal("Invalid data");
    });

    it("shows warnings", async () => {
      // tslint:disable-next-line:no-any
      sinon.spy(service, "reportWarnings" as any);
      await service.perform(file);
      const title = document.querySelector(".modal.in .modal-title");
      expect(title).to.have.property("textContent").equal("Warning");
      const warnings = document.querySelector(".modal-body");
      expect(warnings).to.have.property("textContent")
        .matches(/no value for cit\/@ref in title: Moo,/);
      // tslint:disable-next-line:no-any
      expect((service as any).reportWarnings).to.have.been.calledOnce;
    });
  });

  describe("#gatherTitles", () => {
    let doc: Document;
    let logger: Logger;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
      logger = new Logger();
    }));

    it("gathers titles", () => {
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);

      rservice.gatherTitles(doc, titles, titleToLines, logger);
      expect(logger).to.have.property("hasErrors").false;
      expect(titles).to.have.keys(["Abhidharmakośabhāṣya", "Moo"]);
      expect(titleToLines).to.have.keys(["Abhidharmakośabhāṣya", "Moo"]);
      expect(titleToLines).to.have.property("Abhidharmakośabhāṣya")
        .with.lengthOf(2);
      expect(titleToLines).to.have.property("Moo").with.lengthOf(3);

      const akb = titles["Abhidharmakośabhāṣya"];
      expect(akb.title).to.equal("Abhidharmakośabhāṣya");
      expect(akb.genre).to.equal("śāstra");
      expect(akb.author).to.equal("Vasubandhu");
      expect(akb.tradition).to.equal("abhidharma");
      expect(akb.school).to.equal("N/A");
      expect(akb.period).to.equal("classical");

      const moo = titles["Moo"];
      expect(moo.title).to.equal("Moo");
      expect(moo.genre).to.equal("sūtra");
      expect(moo.author).to.equal("Mooplex");
      expect(moo.tradition).to.equal("milk");
      expect(moo.school).to.equal("pasteurized");
      expect(moo.period).to.equal("old");
    });

    it("throws a processing error if the titles are inconsistent", () => {
      const ref = doc.getElementsByTagName("ref")[0];
      ref.textContent = ref.textContent; // Drop all tags.
      // Skip the 1st part because that's not something we need.
      const parts = ref.textContent!.split(",").slice(1);
      for (let ix = 0; ix < parts.length; ++ix) {
        parts[ix] = parts[ix].trim();
      }

      const fieldNames = [undefined, "genres", "authors", "traditions",
                          "schools", "periods"];
      expect(fieldNames).to.have.lengthOf(parts.length);
      for (let ix = 1; ix < parts.length; ++ix) {
        const fieldName = fieldNames[ix];
        const corrupt = parts.slice();
        corrupt[ix] = "bad";
        ref.textContent = `ignored,${corrupt.join(",")}`;

        const titles: Record<string, Title> = Object.create(null);
        const titleToLines: Record<string, Element[]> = Object.create(null);
        expect(() => {
          rservice.gatherTitles(doc, titles, titleToLines, logger);
        }).to.throw(ProcessingError,
                    `the title Abhidharmakośabhāṣya appears more than once, \
with differing values: ${fieldName} differ: bad vs ${parts[ix]}`);
      }
    });

    it("reports an error if a line is missing a ref", () => {
      const ref = doc.getElementsByTagName("ref")[0];
      const line = ref.parentNode! as HTMLElement;
      line.removeChild(ref);
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      expect(logger.errors).to.have.lengthOf(1);
      expect(logger.errors[0]).to.have.property("message")
        .equal(`invalid line: line without a ref: ${line.outerHTML}`);
    });

    it("reports an error if a ref lacks expected parts", () => {
      const ref = doc.getElementsByTagName("ref")[0];
      ref.textContent = "";
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      expect(logger.errors).to.have.lengthOf(1);
      expect(logger.errors[0]).to.have.property("message")
        .equal(`invalid ref: ref does not contain 6 or 7 parts: `);
    });
  });

  // tslint:disable-next-line:no-http-string
  const MMWP_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/doc";
  // tslint:disable-next-line:mocha-no-side-effect-code
  const XMLNS = `xmlns="${MMWP_NAMESPACE}"`;

  describe("#transformTitle", () => {
    let doc: Document;
    let logger: Logger;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
      logger = new Logger();
    }));

    it("converts a title", () => {
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      expect(logger).to.have.property("hasErrors").false;
      const result =
        rservice.transformTitle("lemValue", titles["Moo"], titleToLines["Moo"],
                                logger);
      expect(result).to.be.instanceof(Document);
      expect(logger).to.have.property("hasErrors").false;

      const root = result!.documentElement;
      expect(root).to.have.property("tagName", "doc");
      expect(root).to.have.nested.property("attributes.version.value", "1");
      expect(root).to.have.nested.property("attributes.title.value", "Moo");
      expect(root).to.have.nested.property("attributes.genre.value", "sūtra");
      expect(root).to.have.nested.property("attributes.author.value",
                                           "Mooplex");
      expect(root).to.have.nested.property("attributes.tradition.value",
                                           "milk");
      expect(root).to.have.nested.property("attributes.school.value",
                                           "pasteurized");
      expect(root).to.have.nested.property("attributes.period.value", "old");
      expect(root).to.have.nested.property("attributes.lem.value", "lemValue");

      expect(root).to.have.property("childNodes").with.lengthOf(3);
      const first = root.firstElementChild!;
      expect(first).to.have.nested.property("attributes.id.value", "1");

      const firstExpected = `<s id="1"> \
<word lem="yāvad" id="1">yāvan</word> \
<word lem="nīla" id="2">nīla-</word> <word lem="pīta" id="3">-pīta-</word>\
<word lem="dīrgha" id="4">-dīrgha-</word> \
<word lem="hrasva" id="5">-hrasva-</word> \
<word lem="stri" id="6">-stri-</word><word lem="puruṣa" id="7">-puruṣa-</word>\
<word lem="mitra" id="8">-mitra-</word>\
<word lem="amitra" id="9">-amitra-</word> \
<word lem="sukha" id="10">-sukha-</word> \
<word lem="duḥkha" id="11">-duḥkha-</word> \
<word lem="adi" id="12">-adi-</word> \
<word lem="nimitta" id="13">-nimitta-</word> \
<word lem="udgrahaṇa" id="14">-dgrahaṇam</word> \
<word lem="adas" id="15">asau</word> \
<word lem="saṃjñā" id="16">saṃjñā-</word> \
<word lem="skandha" id="17">-skandhaḥ</word> \
<word id="18">|</word> <word id="19">sa</word> \
<word lem="punar" id="20">punar</word> \
<word lem="bhid" id="21">bhidyamānaḥ</word> \
<word id="22">ṣaṭsaṃjñākāyā</word> \
<word lem="vedanāvat" id="23">vedanāvat</word> \
<word id="24">||</word> \
<word lem="catur" id="25">caturbhyo</word> \
<word lem="'nye" id="26">'nye</word> \
<word lem="tu" id="27">tu</word> \
<word lem="saṃskāra" id="28">saṃskāra-</word> \
<word lem="skandha" id="29">-skandhaḥ</word> \
<word id="30">rūpavedanāsaṃjñāvijñānebhyaścatubbryo</word> \
<word lem="'nye" id="31">'nye</word> \
<word lem="tu" id="32">tu</word> </s><tr tr="me" p="1">foo</tr>`
        .replace(/<(s|tr) (.*?)>/g, `<$1 ${XMLNS} $2>`);
      expect(first).to.have.nested.property("innerHTML").equal(firstExpected);

      const second = first.nextElementSibling!;
      expect(second).to.have.nested.property("attributes.id.value", "2");

      const third = second.nextElementSibling;
      expect(third).to.have.nested.property("attributes.ref.value", "12.34");
    });

    it("errors on errant avagraha", () => {
      addErrantAvagraha(doc);
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      expect(logger).to.have.property("hasErrors").false;
      const result =
        rservice.transformTitle(
          "lemmaValue",
          titles["Abhidharmakośabhāṣya"],
          titleToLines["Abhidharmakośabhāṣya"], logger);
      expect(result).to.be.null;
      expect(logger).to.have.property("errors").with.lengthOf(1);
      expect(logger).to.have.nested.property("errors[0].message")
        .matches(/^errant avagraha in:/);
    });
  });

  describe("#extractRef", () => {
    for (const str of ["moo",
                       "4-5 something",
                       "4,5 something",
                       "Verse 5 something",
                       "Verse 5. something",
                       "Verse 5.b something"]) {
      it(`does not match ${str}`, () => {
        expect(rservice.extractRef(str)).to.be.null;
      });
    }

    for (const [result, str] of [
      ["1.2", "Verse_1.2 something something"],
      ["3.390", "something 3.390 something else"],
      ["4.5", "a4.5bcd something"],
      ["4.5", "4.5.6 something"],
      ["0.0", "blah 0.0 blah"],
      ["5.67", "something 5.6 7"],
      ["1", "Verse_1 something something"],
      ["123", "Verse _ 1 2 3 something something"],
    ]) {
      it(`matches ${str}`, () => {
        expect(rservice.extractRef(str)!).to.equal(result);
      });
    }
  });

  describe("#makeCitFromLine", () => {
    let doc: Document;
    let logger: Logger;
    let title: Title;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
      logger = new Logger();
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      title = titles["Moo"];
    }));

    it("does not create @ref when we cannot find a number", () => {
      const line = doc.getElementsByTagName("line")[1];
      expect(line.querySelector("page.number")).to.be.null;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 1, logger);
      expect(cit.getAttribute("ref")).to.be.null;
      expect(logger).to.have.property("hasWarnings").true;
      expect(logger).to.have.nested.property("warnings[0].message")
        .match(/^no value for cit\/@ref in title: Moo,/);
    });

    it("creates @ref when the <ref> element had a pageVerse number", () => {
      const line = doc.getElementsByTagName("line")[0];
      expect(line.querySelector("page\\.number")).to.be.null;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 1, logger);
      expect(cit).to.have.nested.property("attributes.ref.value", "010|18");
    });

    it("creates @ref when there is no pageVerse number but page.number " +
       "is present", () => {
         const line = doc.getElementsByTagName("line")[1];
         expect(line.querySelector("page\\.number")).to.be.null;
         const pn = doc.createElement("page.number");
         pn.textContent = "999";
         line.appendChild(pn);
         expect(line.querySelector("page\\.number")).to.not.be.null;
         const { cit } = rservice.makeCitFromLine(title, doc, line, 1, logger);
         expect(cit).to.have.nested.property("attributes.ref.value", "999");
       });

    it("creates @ref when there is no pageVerse number or page.number " +
       "but there is a number pattern in the text", () => {
         const line = doc.getElementsByTagName("line")[4];
         expect(line.querySelector("page\\.number")).to.be.null;

         const { cit } = rservice.makeCitFromLine(title, doc, line, 1, logger);
         expect(cit).to.have.nested.property("attributes.ref.value", "12.34");
       });

    it("sets @id to the value passed", () => {
      const line = doc.getElementsByTagName("line")[0];
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      expect(cit).to.have.nested.property("attributes.id.value", "222");
    });

    it("preserves text", () => {
      const line = doc.createElement("line");
      line.textContent = "something";
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      expect(cit).to.have.property("textContent", "something");
    });

    it("removes ref and page.number element", () => {
      const line = doc.createElement("line");
      line.innerHTML = `a<ref>something</ref>\
<page.number>something</page.number>b<ref>something else</ref>\
<page.number>foo</page.number>c`;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      expect(cit).to.have.property("textContent", "abc");
      expect(cit).to.have.property("firstElementChild").be.null;
    });

    it("leaves notvariant and normalised as they are", () => {
      const line = doc.createElement("line");
      line.innerHTML = `a<notvariant>something</notvariant>\
<normalised>something</normalised>b<notvariant>something else</notvariant>\
<normalised>foo</normalised>c`;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      expect(cit).to.have.property("innerHTML", line.innerHTML);
    });

    it("unwraps other elements", () => {
      const line = doc.createElement("line");
      line.innerHTML = `a<foo>b</foo>c<bar>d</bar>e`;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      expect(cit).to.have.property("innerHTML", "abcde");
    });
  });

  describe("#convertMarkedToWord", () => {
    let doc: Document;
    let logger: Logger;
    let title: Title;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
      logger = new Logger();
      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      rservice.gatherTitles(doc, titles, titleToLines, logger);
      title = titles["Moo"];
    }));

    it("converts marked words to word elements", () => {
      const line = doc.createElement("line");
      line.innerHTML = `a<notvariant>something</notvariant>\
<normalised orig="a">something</normalised>b\
<notvariant>something else</notvariant>\
<normalised orig="b">foo</normalised>c`;
      const { cit } = rservice.makeCitFromLine(title, doc, line, 222, logger);
      rservice.convertMarkedToWord(doc, cit);
      const expected = `a<word lem="something">something</word>\
<word lem="something">a</word>b\
<word lem="something else">something else</word>\
<word lem="foo">b</word>c`.replace(/<word/g, `<word ${XMLNS}`);
      expect(cit).to.have.property("innerHTML", expected);
    });
  });

  describe("#cleanText", () => {
    let doc: Document;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
    }));

    it("performs a DOM normalization", () => {
      const cit = doc.createElement("cit");
      const word = doc.createElement("word");
      cit.appendChild(word);
      word.appendChild(doc.createTextNode("foo"));
      word.appendChild(doc.createTextNode("bar"));
      cit.appendChild(doc.createTextNode(""));

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("foobar");
      expect(cit).to.have.property("childNodes").with.lengthOf(1);
      expect(word).to.have.property("childNodes").with.lengthOf(1);
    });

    it("converts / to |", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>/</word>/";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("||");
    });

    it("strips **", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>**</word>**";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("");
    });

    it("removes spaces before and after dashes", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word> - a - </word>- b -";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("-a--b-");
    });

    it("converts multi dashes to a single one", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "--a - - b - - - c";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("-a-b-c");
    });

    it("converts multiple spaces to a single space", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>  a  </word>  b  ";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal(" a  b ");
    });

    it("removes text nodes that become empty", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>a</word>**";

      rservice.cleanText(cit);
      expect(cit).to.have.property("textContent").equal("a");
      expect(cit).to.have.property("childNodes").with.lengthOf(1);
    });
  });

  describe("#breakIntoWords", () => {
    let doc: Document;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
    }));

    it("breaks the citation into words", () => {
      const cit = doc.createElementNS(MMWP_NAMESPACE, "cit");
      cit.innerHTML =
        ` something-else-s <word>or </word> <word>other</word> words \
<word>foo-</word><word>-bar</word> and more `;

      rservice.breakIntoWords(doc, cit);

      const expected =
        ` <word>something-</word><word>-else-</word><word>-s</word> \
<word>or </word> <word>other</word> <word>words</word> \
<word>foo-</word><word>-bar</word> <word>and</word> <word>more</word> `
        .replace(/<word\b/g, `<word ${XMLNS}`);
      expect(cit).to.have.property("innerHTML").equal(expected);
    });
  });

  describe("#cleanDashes", () => {
    let doc: Document;
    before(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
    }));

    it("throws on unexpected element", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<foo/>";
      expect(() => {
        rservice.cleanDashes(cit, cit);
      }).to.throw(Error, "unexpected element: foo");
    });

    it("throws on word with final dash but no following sibling", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>foo-</word>";
      expect(() => {
        rservice.cleanDashes(cit, cit);
      }).to.throw(Error,
                  /^word with trailing dash has no following sibling:/);
    });

    it("throws on word with initial dash but no preceding sibling", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<word>-foo</word>";
      expect(() => {
        rservice.cleanDashes(cit, cit);
      }).to.throw(Error,
                  /^word with leading dash has no preceding sibling:/);
    });

    it("cleans the dashes", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = `\
<word>blah</word><word>-foo-</word><word>bar</word>\
<word>bwip-</word><word>fwip-</word><word>moo</word>\
<word>aaa</word><word>-bbb</word><word>-ccc</word>\
`;
      rservice.cleanDashes(cit, cit);
      expect(cit).to.have.property("innerHTML").equal(`\
<word>blah-</word><word>-foo-</word><word>-bar</word>\
<word>bwip-</word><word>-fwip-</word><word>-moo</word>\
<word>aaa-</word><word>-bbb-</word><word>-ccc</word>`);
    });
  });

  describe("#populateLem", () => {
    let doc: Document;
    before(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
    }));

    it("throws on unexpected element", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = "<foo/>";
      expect(() => {
        rservice.cleanDashes(cit, cit);
      }).to.throw(Error, "unexpected element: foo");
    });

    it("populates @lem", () => {
      const cit = doc.createElement("cit");
      cit.innerHTML = `\
<word>blah-</word><word>-foo-</word><word>-bar</word>\
<word>bwip-</word><word>-fwip-</word><word>-moo</word>\
<word>aaa-</word><word>-bbb-</word><word>-ccc</word>\
<word lem="a">blah-</word><word>-q</word>`;
      rservice.populateLem(cit);
      expect(cit).to.have.property("innerHTML").equal(`\
<word lem="blah">blah-</word><word lem="foo">-foo-</word><word>-bar</word>\
<word lem="bwip">bwip-</word><word lem="fwip">-fwip-</word><word>-moo</word>\
<word lem="aaa">aaa-</word><word lem="bbb">-bbb-</word><word>-ccc</word>\
<word lem="a">blah-</word><word>-q</word>`);
    });
  });

  describe("#checkCit", () => {
    let doc: Document;
    let logger: Logger;
    beforeEach(() => provider.getDoc("multiple-titles-1.xml").then((newDoc) => {
      doc = newDoc;
      logger = new Logger();
    }));

    it("reports errant avagrahas", () => {
      addErrantAvagraha(doc);
      // We pass a line element rather than a cit element. By the time checkCit
      // is called in the service, it gets a cit element but passing a line does
      // not matter.
      rservice.checkCit(doc.getElementsByTagName("line")[0], logger);
      expect(logger.errors).to.have.lengthOf(1);
      expect(logger).to.have.nested.property("errors[0].message")
        .matches(/^errant avagraha in:/);
    });

    it("reports no error if the input is fine", () => {
      // We pass a line element rather than a cit element. By the time checkCit
      // is called in the service, it gets a cit element but passing a line does
      // not matter.
      rservice.checkCit(doc.getElementsByTagName("line")[0], logger);
      expect(logger).to.have.property("hasErrors").false;
    });
  });

});
