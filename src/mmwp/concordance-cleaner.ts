import { ParsingError, safeParse } from "salve-dom";

import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { getConcordanceGrammar } from "./concordance-util";
import { ProcessingError, safeValidate, splitOnExt } from "./util";

export class ConcordanceCleaner {
  constructor(private xmlFiles: XMLFilesService, private overwrite: boolean) {
  }

  async perform(input: XMLFile): Promise<XMLFile[]> {
    const data = await input.getData();
    let doc: Document;
    try {
      doc = safeParse(data);
    }
    catch (ex) {
      if (!(ex instanceof ParsingError)) {
        throw ex;
      }

      throw new ProcessingError(
        "Parsing Error",
        "The document cannot be parsed. It is probably due to a \
well-formedness error. Please check the file for well-formedness outside of \
this application and fix any errors before uploading again.");
    }

    await safeValidate(getConcordanceGrammar(), doc);

    return this._perform(input.name, doc);
  }

  async _perform(inputName: string, doc: Document): Promise<XMLFile[]> {
    const refToLine: Record<string, Element> = Object.create(null);

    for (const line of Array.from(doc.getElementsByTagName("line"))) {
      const refText = this.getRefText(line);
      if (refToLine[refText] === undefined) {
        refToLine[refText] = line;
      }
    }

    const concordance = doc.getElementsByTagName("concordance")[0];
    // tslint:disable-next-line:no-inner-html
    concordance.innerHTML = "";

    for (const ref of Object.keys(refToLine)) {
      const line = refToLine[ref];
      this.cleanLine(line);
      concordance.appendChild(line);
    }

    const outputName = this.makeOutputName(inputName);
    await this.checkOutput(outputName, doc);

    const newRecord =
      await this.xmlFiles.makeRecord(outputName, doc.documentElement.outerHTML);

    if (this.overwrite) {
      const oldRecord = await this.xmlFiles.getRecordByName(outputName);
      if (oldRecord !== undefined) {
        newRecord.id = oldRecord.id;
      }
    }

    return [await this.xmlFiles.updateRecord(newRecord)];
  }

  private makeOutputName(inputName: string): string {
    if (this.overwrite) {
      return inputName;
    }

    const [inputStart, inputExt] = splitOnExt(inputName);
    const newStart = `${inputStart}-cleaned`;
    return inputExt === "" ? newStart : `${newStart}.${inputExt}`;
  }

  private cleanLine(line: Element): void {
    line.normalize();
    const walker = line.ownerDocument!.createTreeWalker(line,
                                                        NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      text.data = text.data.replace(/,/g, "").replace(/["\u201C\u201D]/g, "'");
    }

    const refText = this.getRefText(line);
    if (refText.startsWith(",")) {
      const num = line.getAttribute("num");
      if (num === null) {
        throw new Error("@num is mandatory but somehow missing");
      }
      line.setAttribute("refs", `000${num}${refText}`);
    }
  }

  private async checkOutput(outputName: string,
                            titleDoc: Document): Promise<void> {
    if (!this.overwrite) {
      const record = await this.xmlFiles.getRecordByName(outputName);
      if (record !== undefined) {
        throw new ProcessingError("File Name Error",
                                  `This would overwrite: ${outputName}`);
      }
    }

    await safeValidate(getConcordanceGrammar(), titleDoc);
  }

  private getRefText(line: Element): string {
    const text = line.getAttribute("refs");
    if (text === null) {
      throw new Error("cannot get @refs, which is mandatory");
    }
    return text;
  }
}
