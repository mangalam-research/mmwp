import "chai";
import "chai-as-promised";
import "mocha";

const expect = chai.expect;

import { CSVDocument, CSVDocumentRenderer, CSVRow } from "mmwp/csv";

describe("csv", () => {
  describe("CSVDocument", () => {
    describe("#constructor", () => {
      it("throws on bad column names", () => {
        expect(() => new CSVDocument([""]))
          .to.throw(Error, /^cannot support column name/);
      });

      it("throws on duplicate column names", () => {
        expect(() => new CSVDocument(["a", "b", "a"]))
          .to.throw(Error, "duplicate name: a");
      });
    });

    describe("#columnNameSet", () => {
      it("contains the column names", () => {
        const columns = ["a", "b"];
        const doc = new CSVDocument(columns);
        expect(Array.from(doc.columnNameSet)).to.have.members(columns);
      });
    });

    describe("#columnNames", () => {
      it("contains the column names, ordered", () => {
        const columns = ["a", "b"];
        const doc = new CSVDocument(columns);
        expect(doc.columnNames).to.equal(columns);
      });
    });

    describe("#makeRow", () => {
      it("makes a new row", () => {
        const columns = ["a", "b"];
        const doc = new CSVDocument(columns);
        let row = doc.makeRow();
        expect(row).to.be.instanceOf(CSVRow);
        expect(doc.rows).to.be.lengthOf(1);
        expect(doc.rows[0]).to.equal(row);

        row = doc.makeRow();
        expect(row).to.be.instanceOf(CSVRow);
        expect(doc.rows).to.be.lengthOf(2);
        expect(doc.rows[1]).to.equal(row);
        expect(doc.rows[0]).to.not.equal(doc.rows[1]);
      });
    });
  });

  describe("CSVRow", () => {
    describe("#constructor", () => {
      it("constructs an empty row", () => {
        const doc = new CSVDocument(["a", "b"]);
        const row = new CSVRow(doc);
        expect(row.doc).to.equal(doc);
        expect(Object.keys(row.columns)).to.have.lengthOf(0);
      });
    });

    describe("#setColumn", () => {
      it("sets a column", () => {
        const doc = new CSVDocument(["a", "b"]);
        const row = doc.makeRow();
        expect(Object.keys(row.columns)).to.have.lengthOf(0);
        row.setColumn("a", "aValue");
        expect(row.columns).to.have.property("a").equal("aValue");
        expect(Object.keys(row.columns)).to.have.lengthOf(1);

        row.setColumn("b", "bValue");
        expect(row.columns).to.have.property("a").equal("aValue");
        expect(row.columns).to.have.property("b").equal("bValue");
        expect(Object.keys(row.columns)).to.have.lengthOf(2);
      });

      it("throws on setting columns that don't exist", () => {
        const doc = new CSVDocument(["a", "b"]);
        const row = doc.makeRow();
        expect(() => {
          row.setColumn("foo", "aValue");
        }).to.throw(Error, "unknown column name: foo");
      });
    });
  });

  describe("CSVDocumentRenderer", () => {
    describe("#constructor", () => {
      it("constructs", () => {
        const rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });

        expect(rend).to.be.instanceOf(CSVDocumentRenderer);
      });
    });

    describe("#renderColumnName", () => {
      let rend: CSVDocumentRenderer;

      before(() => {
        rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });
      });

      it("leaves simple text intact", () => {
        expect(rend.renderColumnName("a")).to.equal("a");
        expect(rend.renderColumnName("a b")).to.equal("a b");
        expect(rend.renderColumnName("a.b")).to.equal("a.b");
      });

      it("normalizes spaces", () => {
        expect(rend.renderColumnName("a    b \n\t\r c")).to.equal("a b c");
      });

      it("converts double quotes in values", () => {
        expect(rend.renderColumnName(`a " b " c`)).to.equal(`"a "" b "" c"`);
      });

      it("converts commas in values", () => {
        expect(rend.renderColumnName(`a , b`)).to.equal(`"a , b"`);
      });
    });

    describe("#renderHeading", () => {
      let rend: CSVDocumentRenderer;

      before(() => {
        rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });
      });

      it("renders the heading", () => {
        const doc = new CSVDocument(["a", "b", "c"]);
        expect(rend.renderHeading(doc)).to.equal("a,b,c\n");
      });
    });

    describe("#renderColumn", () => {
      let rend: CSVDocumentRenderer;

      before(() => {
        rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });
      });

      it("leaves simple text intact", () => {
        expect(rend.renderColumn("a")).to.equal("a");
        expect(rend.renderColumn("a b")).to.equal("a b");
        expect(rend.renderColumn("a.b")).to.equal("a.b");
      });

      it("normalizes spaces", () => {
        expect(rend.renderColumn("a    b \n\t\r c")).to.equal("a b c");
      });

      it("converts double quotes in values", () => {
        expect(rend.renderColumn(`a " b " c`)).to.equal(`"a "" b "" c"`);
      });

      it("converts commas in values", () => {
        expect(rend.renderColumn(`a , b`)).to.equal(`"a , b"`);
      });

      it("uses a placeholder when needed", () => {
        expect(rend.renderColumn()).to.equal("N/A");
      });
    });

    describe("#renderRow", () => {
      let rend: CSVDocumentRenderer;

      before(() => {
        rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });
      });

      it("renders a simple row", () => {
        const doc = new CSVDocument(["a", "b"]);
        const row = doc.makeRow();
        row.setColumn("b", "bValue");
        row.setColumn("a", "aValue");
        expect(rend.renderRow(doc, row)).to.equal("aValue,bValue\n");
      });

      it("renders a complex row", () => {
        const doc = new CSVDocument(["a", "b", "c"]);
        const row = doc.makeRow();
        row.setColumn("b", "a , \n\t\rb");
        row.setColumn("a", `a " b`);
        expect(rend.renderRow(doc, row)).to.equal(`"a "" b","a , b",N/A\n`);
      });
    });

    describe("#render", () => {
      let rend: CSVDocumentRenderer;

      before(() => {
        rend = new CSVDocumentRenderer({
          placeholder: "N/A",
        });
      });

      it("renders a document", () => {
        const doc = new CSVDocument(["a", "b", "c"]);
        let row = doc.makeRow();
        row.setColumn("b", "a , \n\t\rb");
        row.setColumn("a", `a " b`);

        row = doc.makeRow();
        row.setColumn("b", "bValue");
        row.setColumn("a", "aValue");

        expect(rend.render(doc)).to.equal(`\
a,b,c
"a "" b","a , b",N/A
aValue,bValue,N/A
`);
      });
    });
  });
});
