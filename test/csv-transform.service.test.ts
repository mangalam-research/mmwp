import "chai";
import "mocha";

const expect = chai.expect;

import { safeParse } from "salve-dom";

import { ChunksService } from "dashboard/chunks.service";
import { ProcessingService } from "dashboard/processing.service";
import { db } from "dashboard/store";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { CSVDocument, CSVRow } from "mmwp/csv";
import { COLUMN_NAMES, CSVTransformService } from "mmwp/csv-transform.service";
import { MMWP_NAMESPACE } from "mmwp/namespaces";
import { ProcessingError, validateAnnotatedDocument } from "mmwp/util";

import { DataProvider, expectReject } from "./util";

const RELATION_FIELD_NAMES = [
  "modifies",
  "modifies.case",
  "modifies.number",
  "modifies.sem.cat",
  "modifies.sem.field",
  "modifies.sem.pros",
  "modifies.sem.role",
  "modifies.uncertainty",
  //
  "modified.by",
  "modified.by.case",
  "modified.by.number",
  "modified.by.sem.cat",
  "modified.by.sem.field",
  "modified.by.sem.pros",
  "modified.by.sem.role",
  "modified.by.uncertainty",
  //
  "glossing",
  "glossing.case",
  "glossing.number",
  "glossing.sem.cat",
  "glossing.sem.field",
  "glossing.sem.pros",
  "glossing.sem.role",
  "glossing.uncertainty",
  //
  "glossed.by",
  "glossed.by.case",
  "glossed.by.number",
  "glossed.by.sem.cat",
  "glossed.by.sem.field",
  "glossed.by.sem.pros",
  "glossed.by.sem.role",
  "glossed.by.uncertainty",
  //
  "takes.oblique",
  "takes.oblique.case",
  "takes.oblique.number",
  "takes.oblique.sem.cat",
  "takes.oblique.sem.field",
  "takes.oblique.sem.pros",
  "takes.oblique.sem.role",
  "takes.oblique.uncertainty",
  //
  "oblique.of",
  "oblique.of.case",
  "oblique.of.number",
  "oblique.of.sem.cat",
  "oblique.of.sem.field",
  "oblique.of.sem.pros",
  "oblique.of.sem.role",
  "oblique.of.uncertainty",
  //
  "takes.as.subject.agent",
  "takes.as.subject.agent.case",
  "takes.as.subject.agent.number",
  "takes.as.subject.agent.sem.cat",
  "takes.as.subject.agent.sem.field",
  "takes.as.subject.agent.sem.pros",
  "takes.as.subject.agent.sem.role",
  "takes.as.subject.agent.uncertainty",
  //
  "subject.agent",
  "subject.agent.case",
  "subject.agent.number",
  "subject.agent.sem.cat",
  "subject.agent.sem.field",
  "subject.agent.sem.pros",
  "subject.agent.sem.role",
  "subject.agent.uncertainty",
  //
  "takes.as.object.patient",
  "takes.as.object.patient.case",
  "takes.as.object.patient.number",
  "takes.as.object.patient.sem.cat",
  "takes.as.object.patient.sem.field",
  "takes.as.object.patient.sem.pros",
  "takes.as.object.patient.sem.role",
  "takes.as.object.patient.uncertainty",
  //
  "object.patient",
  "object.patient.case",
  "object.patient.number",
  "object.patient.sem.cat",
  "object.patient.sem.field",
  "object.patient.sem.pros",
  "object.patient.sem.role",
  "object.patient.uncertainty",
  //
  "manner.of",
  "manner.of.case",
  "manner.of.number",
  "manner.of.sem.cat",
  "manner.of.sem.field",
  "manner.of.sem.pros",
  "manner.of.sem.role",
  "manner.of.uncertainty",
  //
  "takes.manner",
  "takes.manner.case",
  "takes.manner.number",
  "takes.manner.sem.cat",
  "takes.manner.sem.field",
  "takes.manner.sem.pros",
  "takes.manner.sem.role",
  "takes.manner.uncertainty",
  //
  "clausal.of",
  "clausal.of.case",
  "clausal.of.number",
  "clausal.of.sem.cat",
  "clausal.of.sem.field",
  "clausal.of.sem.pros",
  "clausal.of.sem.role",
  "clausal.of.uncertainty",
  //
  "takes.clausal",
  "takes.clausal.case",
  "takes.clausal.number",
  "takes.clausal.sem.cat",
  "takes.clausal.sem.field",
  "takes.clausal.sem.pros",
  "takes.clausal.sem.role",
  "takes.clausal.uncertainty",
  //
  "listed.with",
  "listed.with.case",
  "listed.with.number",
  "listed.with.sem.cat",
  "listed.with.sem.field",
  "listed.with.sem.pros",
  "listed.with.sem.role",
  "listed.with.uncertainty",
  //
  "contrasted.with",
  "contrasted.with.case",
  "contrasted.with.number",
  "contrasted.with.sem.cat",
  "contrasted.with.sem.field",
  "contrasted.with.sem.pros",
  "contrasted.with.sem.role",
  "contrasted.with.uncertainty",
  //
  "dep",
  "dep.case",
  "dep.number",
  "dep.sem.cat",
  "dep.sem.field",
  "dep.sem.pros",
  "dep.sem.role",
  "dep.uncertainty",
  //
  "parallel.to",
  "parallel.to.case",
  "parallel.to.number",
  "parallel.to.sem.cat",
  "parallel.to.sem.field",
  "parallel.to.sem.pros",
  "parallel.to.sem.role",
  "parallel.to.uncertainty",
];

function makeRelationPairXML(forward: string, reverse: string,
                             citId: string): string {
  return `<cit id="${citId}" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague" dep.rel="${forward}" \
dep.head="2">-moo</word> \
<word id="2" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">wordA</word> \
<word id="3" lem="b" case="accusative" number="sing" \
sem.cat="id 3 cat a, cat b" sem.field="id 3 semB" \
sem.role="id 3 sem role value" \
sem.pros="neu" uncertainty="other" \
dep.rel="${reverse}" dep.head="1">wordB</word> \
<word id="4" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="${reverse}" dep.head="1">wordA</word> \
<!-- The following words are excluded -->\
<word id="5" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="${forward}" dep.head="1">wordA</word> \
<word id="6" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="${reverse}" dep.head="3">wordA</word>\
</s><tr>Something or other</tr></cit>`;
}

function makeSingleRelationXML(relation: string, citId: string): string {
  return `<cit id="${citId}" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague" dep.rel="${relation}" \
dep.head="2">-moo</word> \
<word id="2" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">wordA</word> \
<word id="3" lem="b" case="accusative" number="sing" \
sem.cat="id 3 cat a, cat b" sem.field="id 3 semB" \
sem.role="id 3 sem role value" \
sem.pros="neu" uncertainty="other" \
dep.rel="${relation}" dep.head="1">wordB</word> \
<word id="4" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="${relation}" dep.head="1">wordA</word> \
<!-- The following words are excluded -->\
<word id="5" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="modifies" dep.head="1">wordA</word> \
<word id="6" lem="a" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="semA" sem.role="sem role value" \
sem.pros="pos" uncertainty="vague" \
dep.rel="${relation}" dep.head="3">wordA</word>\
</s><tr>Something or other</tr></cit>`;
}

class CSVReader {
  readDocument(data: string): CSVDocument {
    // Drop trailing newlines and spaces.
    const lines = data.replace(/\s+$/, "").split("\n");
    const headings = this.parseRow(lines[0]);
    const doc = new CSVDocument(headings);
    for (const line of lines.slice(1)) {
      const row = doc.makeRow();
      this.readRow(headings, row, line);
    }
    return doc;
  }

  parseRow(data: string): string[] {
    let rest = data;
    const columns: string[] = [];
    while (rest.length > 0) {
      // tslint:disable-next-line:strict-boolean-expressions
      const match = rest.match(/^"(.*?)"(?!")(?:,|$)/) ||
        // tslint:disable-next-line:strict-boolean-expressions
        rest.match(/^(.*?)(?:,|$)/);
      if (match === null) {
        throw new Error(`cannot extract column from: ${rest}`);
      }
      columns.push(match[1].replace("\"\"", "\""));
      rest = rest.substr(match[0].length);
    }

    return columns;
  }

  readRow(headings: string[], row: CSVRow, data: string): void {
    const columns = this.parseRow(data);
    if (columns.length !== headings.length) {
      throw new Error(`unexpected number of columns (${columns.length}) \
for: ${data}`);
    }
    for (let ix = 0; ix < columns.length; ++ix) {
      const heading = headings[ix];
      const column = columns[ix];
      row.setColumn(heading, column);
    }
  }
}

class CSVCompare {
  compare(actualStr: string, expectedStr: string): void {
    const reader = new CSVReader();
    const actual = reader.readDocument(actualStr);
    const expected = reader.readDocument(expectedStr);
    this.compareArrays(actual.columnNames, expected.columnNames);
    let date: string | undefined;
    if (actual.rows.length > 0) {
      date = actual.rows[0].columns["csvCreationDateTime"];
      // "2018-01-18T14:11:32.371Z"
      expect(date).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
    }

    for (let ix = 0; ix < expected.rows.length && ix < actual.rows.length;
         ix++) {
      expect(this.rowToArray(actual.rows[ix]))
        .to.deep.equal(this.rowToArray(expected.rows[ix]));

      // Check that all dates are the same.
      expect(actual.rows[ix].columns["csvCreationDateTime"]).to.equal(date);
    }
    expect(actual.rows).to.be.lengthOf(expected.rows.length);
  }

  rowToArray(row: CSVRow): string[] {
    const ret: string[] = [];
    for (const name of row.doc.columnNames) {
      // csvCreationDateTime is replaced with a placeholder because the expected
      // values cannot contain the same date as the actual CSV document.
      ret.push(name === "csvCreationDateTime" ?
               "@@DATE@@" : row.columns[name]);
    }

    return ret;
  }

  compareArrays(actual: ReadonlyArray<string>,
                expected: ReadonlyArray<string>): void {
    expect(actual).to.deep.equal(expected);
  }
}

// tslint:disable-next-line:max-func-body-length
describe("CSVTransformService", () => {
  let xmlFilesService: XMLFilesService;
  let service: CSVTransformService;
  let bad: XMLFile;
  let noext: XMLFile;
  let provider: DataProvider;

  before(() => {
    provider = new DataProvider("/base/test/data/");
    xmlFilesService = new XMLFilesService(new ChunksService());
    service = new CSVTransformService(new ProcessingService());
  });

  beforeEach(async () => {
    bad = await xmlFilesService.makeRecord("foo.xml", "<div/>");
    noext = await xmlFilesService.makeRecord("foo", "<div/>");
  });

  after(() => db.delete().then(() => db.open()));

  describe("#getOutputName", () => {
    it("changes the extension", () => {
      expect(service.getOutputName(bad)).to.equal("foo.csv");
    });

    it("adds an extension", () => {
      expect(service.getOutputName(noext)).to.equal("foo.csv");
    });
  });

  describe("#fillStartColumns", () => {
    it("fills the columns", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1"><word id="1" lem="lemmaValue">moo</word></s></cit>`);
      const cit = doc.firstElementChild!;
      const word = cit.firstElementChild!.firstElementChild!;
      service.fillStartColumns("abc", {
        title: "Some title",
        genre: "Some genre",
        author: "Some author",
        tradition: "Some tradition",
        school: "Some school",
        period: "Some period",
      }, cit, word, row);

      expect(row.columns).to.have.property("id").equal("abc");
      expect(row.columns).to.have.property("lemma").equal("lemmaValue");
      expect(row.columns).to.have.property("title").equal("Some title");
      expect(row.columns).to.have.property("genre").equal("Some genre");
      expect(row.columns).to.have.property("author").equal("Some author");
      expect(row.columns).to.have.property("tradition").equal("Some tradition");
      expect(row.columns).to.have.property("school").equal("Some school");
      expect(row.columns).to.have.property("period").equal("Some period");
      expect(row.columns).to.have.property("ref").equal("refValue");

      expect(row.columns).to.have.keys(["id", "lemma", "title", "genre",
                                        "author", "tradition", "school",
                                        "period", "ref"]);
    });
  });

  describe("#fillCotextColumns", () => {
    it("fills the columns", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue">moo</word>\
<word id="2" lem="a" sem.field="semA">wordA</word>\
<word id="3" lem="b" sem.field="semB">wordB</word>\
<word id="4" lem="a" sem.field="semA">wordA</word>\
</s></cit>`);
      const cit = doc.firstElementChild!;
      const word = cit.firstElementChild!.firstElementChild!;
      service.fillCotextColumns(cit, word, row);
      expect(row.columns).to.have.property("cotext").equal("a;;b;;a");
      expect(row.columns).to.have.property("cotextSemField")
        .equal("semA;;semB;;semA");
      expect(row.columns).to.have.keys(["cotext", "cotextSemField"]);
    });
  });

  describe("#fillAttributeColumns", () => {
    it("fills the columns", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">moo</word>\
<word id="2" lem="a" sem.field="semA">wordA</word>\
<word id="3" lem="b" sem.field="semB">wordB</word>\
<word id="4" lem="a" sem.field="semA">wordA</word>\
</s></cit>`);
      const cit = doc.firstElementChild!;
      const word = cit.firstElementChild!.firstElementChild!;
      service.fillAttributeColumns(word, row);
      expect(row.columns).to.have.property("lemma.case").equal("nominative");
      expect(row.columns).to.have.property("lemma.number").equal("dual");
      expect(row.columns).to.have.property("lemma.sem.cat")
        .equal("cat a, cat b");
      expect(row.columns).to.have.property("lemma.sem.field")
        .equal("sem field value");
      expect(row.columns).to.have.property("lemma.sem.role")
        .equal("sem role value");
      expect(row.columns).to.have.property("lemma.sem.pros").equal("neg");
      expect(row.columns).to.have.property("lemma.uncertainty").equal("vague");
      expect(row.columns).to.have.property("lemma.compounded").equal("NO");
      expect(row.columns).to.have.keys(["lemma.case", "lemma.number",
                                        "lemma.sem.cat", "lemma.sem.field",
                                        "lemma.sem.role", "lemma.sem.pros",
                                        "lemma.uncertainty",
                                        "lemma.compounded"]);
    });

    it("handles compounds", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">-moo</word>\
<word id="2" lem="a" sem.field="semA">wordA</word>\
<word id="3" lem="b" sem.field="semB">wordB</word>\
<word id="4" lem="a" sem.field="semA">wordA</word>\
</s></cit>`);
      const cit = doc.firstElementChild!;
      const word = cit.firstElementChild!.firstElementChild!;
      service.fillAttributeColumns(word, row);
      expect(row.columns).to.have.property("lemma.compounded").equal("YES");
      expect(row.columns).to.have.keys(["lemma.case", "lemma.number",
                                        "lemma.sem.cat", "lemma.sem.field",
                                        "lemma.sem.role", "lemma.sem.pros",
                                        "lemma.uncertainty",
                                        "lemma.compounded"]);
    });
  });

  describe("#fillCitationTranslationColumns", () => {
    it("fills the columns, without translation", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">-moo</word> \
<word id="2" lem="a" sem.field="semA">wordA</word> \
<word id="3" lem="b" sem.field="semB">wordB</word> \
<word id="4" lem="a" sem.field="semA">wordA</word>\
</s></cit>`);
      const cit = doc.firstElementChild!;
      service.fillCitationTranslationColumns(cit, row);
      expect(row.columns).to.have.property("citation")
        .equal("-moo wordA wordB wordA");
      expect(row.columns).to.have.keys(["citation"]);
    });

    it("fills the columns, with translation", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const doc =
        safeParse(`<cit id="1" ref="refValue" xmlns='${MMWP_NAMESPACE}'>\
<s id="1">\
<word id="1" lem="lemmaValue" case="nominative" number="dual" \
sem.cat="cat a, cat b" sem.field="sem field value" sem.role="sem role value" \
sem.pros="neg" uncertainty="vague">-moo</word> \
<word id="2" lem="a" sem.field="semA">wordA</word> \
<word id="3" lem="b" sem.field="semB">wordB</word> \
<word id="4" lem="a" sem.field="semA">wordA</word>\
</s><tr>Something or other</tr></cit>`);
      const cit = doc.firstElementChild!;
      service.fillCitationTranslationColumns(cit, row);
      expect(row.columns).to.have.property("citation")
        .equal("-moo wordA wordB wordA");
      expect(row.columns).to.have.property("translation")
        .equal("Something or other");
      expect(row.columns).to.have.keys(["citation", "translation"]);
    });
  });

  describe("#fillRelationColumns", () => {
    function makeTestForPair(forward: string, reverse: string): void {
      it(`fills the columns for ${forward}`, () => {
        const csv = new CSVDocument(COLUMN_NAMES);
        const row = csv.makeRow();
        const doc = safeParse(makeRelationPairXML(forward, reverse, "1"));
        const cit = doc.firstElementChild!;
        const word = cit.firstElementChild!.firstElementChild!;
        service.fillRelationColumns(word, row);
        expect(row.columns).to.have.keys(RELATION_FIELD_NAMES);
        expect(row.columns).to.have.property(forward).equal("b;;a;;a");
        expect(row.columns).to.have.property(`${forward}.case`)
          .equal("accusative;;nominative;;nominative");
        expect(row.columns).to.have.property(`${forward}.number`)
          .equal("sing;;dual;;dual");
        expect(row.columns).to.have.property(`${forward}.sem.cat`)
          .equal("id 3 cat a, cat b;;cat a, cat b;;cat a, cat b");
        expect(row.columns).to.have.property(`${forward}.sem.field`)
          .equal("id 3 semB;;semA;;semA");
        expect(row.columns).to.have.property(`${forward}.sem.pros`)
          .equal("neu;;pos;;neg");
        expect(row.columns).to.have.property(`${forward}.sem.role`)
          .equal("id 3 sem role value;;sem role value;;sem role value");
        expect(row.columns).to.have.property(`${forward}.uncertainty`)
          .equal("other;;vague;;vague");
      });
    }

    for (const [forward, reverse] of [
      ["modifies", "modified.by"],
      ["glossing", "glossed.by"],
      ["takes.oblique", "oblique.of"],
      ["takes.as.subject.agent", "subject.agent"],
      ["takes.as.object.patient", "object.patient"],
      ["manner.of", "takes.manner"],
      ["clausal.of", "takes.clausal"],
    ]) {
      // tslint:disable-next-line:mocha-no-side-effect-code
      makeTestForPair(forward, reverse);
      // tslint:disable-next-line:mocha-no-side-effect-code
      makeTestForPair(reverse, forward);
    }

    function makeTestForSingle(relation: string): void {
      it(`fills the columns for ${relation}`, () => {
        const csv = new CSVDocument(COLUMN_NAMES);
        const row = csv.makeRow();
        const doc = safeParse(makeSingleRelationXML(relation, "1"));
        const cit = doc.firstElementChild!;
        const word = cit.firstElementChild!.firstElementChild!;
        service.fillRelationColumns(word, row);
        expect(row.columns).to.have.keys(RELATION_FIELD_NAMES);
        expect(row.columns).to.have.property(relation).equal("b;;a;;a");
        expect(row.columns).to.have.property(`${relation}.case`)
          .equal("accusative;;nominative;;nominative");
        expect(row.columns).to.have.property(`${relation}.number`)
          .equal("sing;;dual;;dual");
        expect(row.columns).to.have.property(`${relation}.sem.cat`)
          .equal("id 3 cat a, cat b;;cat a, cat b;;cat a, cat b");
        expect(row.columns).to.have.property(`${relation}.sem.field`)
          .equal("id 3 semB;;semA;;semA");
        expect(row.columns).to.have.property(`${relation}.sem.pros`)
          .equal("neu;;pos;;neg");
        expect(row.columns).to.have.property(`${relation}.sem.role`)
          .equal("id 3 sem role value;;sem role value;;sem role value");
        expect(row.columns).to.have.property(`${relation}.uncertainty`)
          .equal("other;;vague;;vague");
      });
    }

    for (const relation of ["listed.with", "contrasted.with", "dep",
                            "parallel.to"]) {
      // tslint:disable-next-line:mocha-no-side-effect-code
      makeTestForSingle(relation);
    }
  });

  describe("#fillBookkepingColumns", () => {
    it("fills the columns", () => {
      const csv = new CSVDocument(COLUMN_NAMES);
      const row = csv.makeRow();
      const date = new Date().toISOString();
      service.fillBookkepingColumns(date, row);
      expect(row.columns).to.have.property("csvCreationDateTime").equal(date);
      expect(row.columns).to.have.property("csvFormatVersion").equal("1");
    });
  });

  describe("#transform", () => {
    it("file resulting in empty CSV", async () => {
      const data = await provider.getText("csv-transform-empty.xml");
      const expected = await provider.getText("csv-transform-empty.csv");

      const doc = await validateAnnotatedDocument(data);
      const result = await service.transform(doc);
      expect(result).to.equal(expected);
    });

    it("simple file", async () => {
      const data = await provider.getText("csv-transform-simple.xml");
      const expected = await provider.getText("csv-transform-simple.csv");

      const doc = await validateAnnotatedDocument(data);
      const result = await service.transform(doc);
      new CSVCompare().compare(result, expected);
    });

    it("complex file", async () => {
      const data = await provider.getText("csv-transform-complex.xml");
      const expected = await provider.getText("csv-transform-complex.csv");

      const doc = await validateAnnotatedDocument(data);
      const result = await service.transform(doc);
      new CSVCompare().compare(result, expected);
    });
  });

  describe("#perform", () => {
    let file: XMLFile;
    let malformed: XMLFile;
    beforeEach(async () => {
      const data = await provider.getText("annotated-file-1.xml");
      file = await xmlFilesService.makeRecord("foo", data);
      malformed = await xmlFilesService.makeRecord("foo", "");
    });

    it("converts a file", () => service.perform(file));

    it("errors if the file is invalid", () =>
       expectReject(
         service.perform(bad),
         ProcessingError,
         `<p>tag not allowed here: {"ns":"","name":"div"}<\/p>
<p>tag required: {"ns":"http://mangalamresearch.org/ns/mmwp/doc",\
"name":"doc"}</p>`));

    it("errors if the file is malformed", () =>
       expectReject(
         service.perform(malformed),
         ProcessingError,
         "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again."));
  });
});
