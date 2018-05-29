import "chai";
import "mocha";

const expect = chai.expect;

import { AnnotatedDocumentCSVRenderer } from "mmwp/annotated-document-csv";
import { CSVDocument } from "mmwp/csv";

describe("annotated-document-csv", () => {
  describe("AnnotatedDocumentCSVRenderer", () => {
    describe("#constructor", () => {
      it("constructs", () => {
        const rend = new AnnotatedDocumentCSVRenderer({
          placeholder: "N/A",
        });

        expect(rend).to.be.instanceOf(AnnotatedDocumentCSVRenderer);
      });
    });

    describe("#renderColumnName", () => {
      let rend: AnnotatedDocumentCSVRenderer;

      before(() => {
        rend = new AnnotatedDocumentCSVRenderer({
          placeholder: "N/A",
        });
      });

      it("leaves simple text intact", () => {
        expect(rend.renderColumnName("a")).to.equal("a");
      });

      it("converts to camel case", () => {
        expect(rend.renderColumnName("a.be.ce")).to.equal("aBeCe");
      });

      it("throws on bad column names", () => {
        expect(() => rend.renderColumnName("a+b"))
          .to.throw(Error, /^cannot support column name/);
        expect(() => rend.renderColumnName("a\"b"))
          .to.throw(Error, /^cannot support column name/);
        expect(() => rend.renderColumnName("a b"))
          .to.throw(Error, /^cannot support column name/);
        expect(() => rend.renderColumnName("a..b"))
          .to.throw(Error, /^cannot support column name/);
        expect(() => rend.renderColumnName(".a"))
          .to.throw(Error, /^cannot support column name/);
        expect(() => rend.renderColumnName("a."))
          .to.throw(Error, /^cannot support column name/);
      });
    });

    describe("#render", () => {
      let rend: AnnotatedDocumentCSVRenderer;

      before(() => {
        rend = new AnnotatedDocumentCSVRenderer({
          placeholder: "N/A",
        });
      });

      it("renders a document", () => {
        const doc = new CSVDocument(["a.b", "b", "c"]);
        let row = doc.makeRow();
        row.setColumn("b", "a , \n\t\rb");
        row.setColumn("a.b", `a " b`);

        row = doc.makeRow();
        row.setColumn("b", "bValue");
        row.setColumn("a.b", "aValue");

        expect(rend.render(doc)).to.equal(`\
aB,b,c
"a "" b","a , b",N/A
aValue,bValue,N/A
`);
      });
    });
  });
});
