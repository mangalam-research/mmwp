import { Injectable } from "@angular/core";
import { alert } from "bootbox";
import { constructTree, Grammar } from "salve";
import * as slug from "slug";

import { ProcessingService } from "dashboard/processing.service";
import { fixPrototype } from "dashboard/util";
import { XMLFile } from "dashboard/xml-file";
import { XMLFilesService } from "dashboard/xml-files.service";
import { XMLTransformService } from "dashboard/xml-transform.service";
// tslint:disable-next-line:no-require-imports
import concordance = require("./internal-schemas/concordance");
// tslint:disable-next-line:no-require-imports
import docUnannotated = require("./internal-schemas/doc-unannotated");
import { validate } from "./util";

// tslint:disable-next-line:no-http-string
const MMWP_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/doc";

export class TitleEqualityError extends Error {
  constructor(message: string) {
    super();
    this.name = "TitleEqualityError";
    this.message = message;
    fixPrototype(this, TitleEqualityError);
  }
}

export class ProcessingError extends Error {
  public readonly title: string;

  constructor(title: string, message: string) {
    super();
    this.title = "ProcessingError";
    this.message = message;
    this.title = title;
    fixPrototype(this, ProcessingError);
  }
}

// tslint:disable-next-line:no-any
function assertEqual(name: string, one: any, other: any): void {
  if (one !== other) {
    throw new TitleEqualityError(`${name} differ: ${one} vs ${other}`);
  }
}

export class CheckError {
  constructor(public readonly message: string) {}

  toString(): string {
    return this.message;
  }
}

export class Warning {
  constructor(public readonly message: string) {}

  toString(): string {
    return this.message;
  }
}

export class Logger {
  private readonly _errors: CheckError[] = [];
  private readonly _warnings: Warning[] = [];

  warn(message: string): void {
    this._warnings.push(new Warning(message));
  }

  error(...messages: (string | CheckError)[]): void {
    for (let message of messages) {
      if (typeof message === "string") {
        message = new CheckError(message);
      }
      this._errors.push(message);
    }
  }

  get hasErrors(): boolean {
    return this._errors.length > 0;
  }

  get hasWarnings(): boolean {
    return this._warnings.length > 0;
  }

  get errors(): ReadonlyArray<CheckError> {
    return this._errors;
  }

  get warnings(): ReadonlyArray<Warning> {
    return this._warnings;
  }
}

class ParsedRef{
  constructor(readonly pageVerse: string | undefined,
              readonly title: string,
              readonly genre: string,
              readonly author: string,
              readonly tradition: string,
              readonly school: string,
              readonly period: string) {}

  static fromCSV(text: string, logger?: Logger): ParsedRef | null {
    const parts = text.split(",");
    if (parts.length !== 7 && parts.length !== 6) {
      if (logger !== undefined) {
        logger.error(`invalid ref: ref does not contain 6 or 7 parts: ${text}`);
      }
      return null;
    }

    for (let ix = 0; ix < parts.length; ++ix) {
    parts[ix] = parts[ix].trim();
    }

    let pageVerse;
    if (parts.length === 7) {
      pageVerse = parts.shift();
    }

    // Apparently we cannot use new Title(...parts);
    const [title, genre, author, tradition, school, period] = parts;
    return new ParsedRef(pageVerse, title, genre, author, tradition, school,
                         period);
  }
}

class Title {
  constructor(readonly title: string,
              readonly genre: string,
              readonly author: string,
              readonly tradition: string,
              readonly school: string,
              readonly period: string) {}

  static fromCSV(text: string, logger: Logger): Title | null {
    const ref = ParsedRef.fromCSV(text, logger);
    if (ref !== null) {
      return new Title(ref.title, ref.genre, ref.author, ref.tradition,
                       ref.school, ref.period);
    }

    return null;
  }

  /**
   * Assert that two titles are equal. They are equal if all their fields are
   * equal.
   */
  assertEqual(other: Title): void {
    try {
      assertEqual("titles", this.title, other.title);
      assertEqual("genres", this.genre, other.genre);
      assertEqual("authors", this.author, other.author);
      assertEqual("schools", this.school, other.school);
      assertEqual("periods", this.period, other.period);
      assertEqual("traditions", this.tradition, other.tradition);
    }
    catch (ex) {
      if (ex instanceof TitleEqualityError) {
        throw new ProcessingError(
          "Differing Title",
          `the title ${this.title} appears more than once, with differing \
values: ${ex.message}`);
      }

      throw ex;
    }
  }

  toString(): string {
    return `${this.title}, ${this.genre}, ${this.author}, ${this.tradition},
${this.school}, ${this.period}`;
  }
}

async function safeValidate(grammar: Grammar,
                            document: Document): Promise<void> {
  const errors = await validate(grammar, document);
  if (errors.length !== 0) {
    throw new ProcessingError(
      "Validation Error",
      errors.map((x) => `<p>${x.error.toString()}</p>`).join("\n"));
  }
}

@Injectable()
export class ConcordanceTransformService extends XMLTransformService {
  private readonly parser: DOMParser = new DOMParser();

  // Caches for the grammars. We do this at the class level because these
  // objects are immutable.
  private static _concordanceGrammar: Grammar | undefined;
  private static _unannotatedGrammar: Grammar | undefined;

  constructor(private readonly processing: ProcessingService,
              private readonly xmlFiles: XMLFilesService) {
    super("Concordance to doc");
  }

  private get concordanceGrammar(): Grammar {
    if (ConcordanceTransformService._concordanceGrammar === undefined) {
      const clone = JSON.parse(JSON.stringify(concordance));
      ConcordanceTransformService._concordanceGrammar = constructTree(clone);
    }

    return ConcordanceTransformService._concordanceGrammar;
  }

  private get unannotatedGrammar(): Grammar {
    if (ConcordanceTransformService._unannotatedGrammar === undefined) {
      const clone = JSON.parse(JSON.stringify(docUnannotated));
      ConcordanceTransformService._unannotatedGrammar = constructTree(clone);
    }

    return ConcordanceTransformService._unannotatedGrammar;
  }

  async perform(input: XMLFile): Promise<XMLFile[]> {
    this.processing.start(1);
    let ret: XMLFile[];
    try {
      const data = await input.getData();
      const doc = this.parser.parseFromString(data, "text/xml");
      if (doc.documentElement.tagName === "parseerror") {
        throw new Error(`could not parse ${input.name}`);
      }

      const titles: Record<string, Title> = Object.create(null);
      const titleToLines: Record<string, Element[]> = Object.create(null);
      await safeValidate(this.concordanceGrammar, doc);

      const logger = new Logger();
      this.gatherTitles(doc, titles, titleToLines, logger);
      // tslint:disable-next-line:no-non-null-assertion
      const query = doc.querySelector("concordance>heading>query")!
        .textContent!;
      // tslint:disable-next-line:no-non-null-assertion
      const path = doc.querySelector("concordance>heading>corpus")!
        .textContent!;
      const pathParts = path.split("/");
      const base = pathParts[pathParts.length - 1];
      const transformed: { outputName: string, doc: Document }[] = [];
      for (const title of Object.keys(titles)) {
        const titleInfo = titles[title];
        const lines = titleToLines[title];
        const outputName =
          `${title}_${slug(query, "_")}_${slug(base, "_")}.xml`;
        const result = this.transformTitle(titleInfo, lines, logger);
        if (result !== null) {
          transformed.push({ outputName, doc: result });
        }
      }

      // If there are any errors we don't want to move forward.
      if (logger.hasErrors) {
        throw new ProcessingError(
          "Invalid data",
          logger.errors.map((x) => `<p>${x}</p>`).join("\n"));
      }

      const promises: Promise<{titleDoc: Document,
                               outputName: string}>[] = [];
      for (const { outputName, doc: titleDoc } of transformed) {
        promises.push(
          (async () => {
            const record = await this.xmlFiles.getRecordByName(outputName);
            if (record !== undefined) {
              throw new ProcessingError(
                "File Name Error", `This would overwrite: ${outputName}`);
            }
            await safeValidate(this.unannotatedGrammar, titleDoc);
            return { titleDoc, outputName };
          })());
      }

      const results = await Promise.all(promises);

      if (logger.hasWarnings) {
        this.reportWarnings(
          logger.warnings.map((x) => `<p>${x}</p>`).join("\n"));
      }

      ret = await Promise.all(
        results.map(async ({ outputName, titleDoc }) => {
          return this.xmlFiles.updateRecord(
            await this.xmlFiles.makeRecord(
              outputName,
              titleDoc.documentElement.outerHTML));
        }));
    }
    catch (err) {
      if (err instanceof ProcessingError) {
        this.reportFailure(err.title !== undefined ? err.title : "Error",
                           err.message);
        throw err;
      }

      this.reportFailure("Internal failure", err.toString());
      throw err;
    }
    finally {
      this.processing.increment();
      this.processing.stop();
    }

    return ret;
  }

  private gatherTitles(doc: Document, titles: Record<string, Title>,
                       titleToLines: Record<string, Element[]>,
                       logger: Logger): void {
    for (const line of Array.from(doc.getElementsByTagName("line"))) {
      const ref = line.querySelector("ref");
      if (ref === null) {
        logger.error(`invalid line: line without a \
ref: ${line.outerHTML}`);
      }
      else {
        // tslint:disable-next-line:no-non-null-assertion
        const refText = ref.textContent!;
        const newTitle = Title.fromCSV(refText, logger);
        if (newTitle !== null) {
          const title = newTitle.title;
          if (!(title in titles)) {
            titles[title] = newTitle;
          }
          else {
            titles[title].assertEqual(newTitle);
          }

          let lines: Element[] = titleToLines[title];
          if (lines === undefined) {
            lines = titleToLines[title] = [];
          }

          lines.push(line);
        }
      }
    }
  }

  private transformTitle(titleInfo: Title, lines: Element[],
                         logger: Logger): Document | null {
    const title = titleInfo.title;
    let citId = 1;
    const doc = this.parser.parseFromString(`<doc xmlns='${MMWP_NAMESPACE}'/>`,
                                            "text/xml");
    const docEl = doc.firstElementChild;
    if (docEl === null) {
      throw new Error("no child in the document");
    }
    docEl.setAttribute("version", "1");
    docEl.setAttribute("title", title);
    docEl.setAttribute("genre", titleInfo.genre);
    docEl.setAttribute("author", titleInfo.author);
    docEl.setAttribute("tradition", titleInfo.tradition);
    docEl.setAttribute("school", titleInfo.school);
    docEl.setAttribute("period", titleInfo.period);
    for (const line of lines) {
      const cit = this.makeCitFromLine(titleInfo, doc, line, citId++, logger);
      // A few checks that validation cannot catch.
      this.checkCit(cit, logger);
      if (!logger.hasErrors) {
        this.convertMarkedToWord(doc, cit);
        // Clean the text.
        this.cleanText(cit);
        this.breakIntoWords(doc, cit);
        this.cleanDashes(cit, line);

        // We wrap everything in a single sentence. Originally <cit> contained
        // the words directly, and a user was responsible for grouping the words
        // into sentences. This proved a bit onerous (and caused problems
        // because reference had to be made across sentences but Sketch Engine
        // does not allow it). So we decided to have a default single-sentence
        // output and to number the sentence and the words in it. So we add the
        // sentence after all other transformations are made. This makes it easy
        // to rip out if we ever need it.
        this.wrapWordsInSentenceAndNumber(cit);

        docEl.appendChild(cit);
      }
    }

    return logger.hasErrors ? null : doc;
  }

  private extractRef(text: string): string | null {
    const match = text.match(/\d(?:\d|\s)*\.\s*\d(?:\d|\s)*/);
    return match !== null ? match[0].replace(/\s+/g, "") : null;
  }

  private makeCitFromLine(title: Title, doc: Document, line: Element,
                          citId: number, logger: Logger): Element {
    const cit = doc.createElementNS(MMWP_NAMESPACE, "cit");
    const ref = line.querySelector("ref");
    // tslint:disable-next-line:no-non-null-assertion
    const parsedRef = ref === null ? null : ParsedRef.fromCSV(ref.textContent!);
    // A ref or parsedRef which is null has been reported earlier as an error.
    if (parsedRef !== null) {
      // tslint:disable-next-line:no-non-null-assertion
      const pageVerse = parsedRef!.pageVerse;
      cit.setAttribute("id", String(citId));
      let refValue: string | undefined = pageVerse;

      // If we did not get a pageVerse value from the <ref> element, then we
      // look for a <page.number> element and take that.
      if (refValue === undefined) {
        const pageNumber = line.querySelector("page\\.number");
        if (pageNumber !== null) {
          // tslint:disable-next-line:no-non-null-assertion
          refValue = pageNumber.textContent!;
        }
      }

      // If we still have not found a value, we search for a number pattern.
      if (refValue === undefined) {
        // We clone the line and remove <ref>.
        const clone = line.cloneNode(true) as Element;
        // tslint:disable-next-line:no-non-null-assertion
        const clonedRef = clone.querySelector("ref");
        if (clonedRef !== null) {
          clone.removeChild(clonedRef);
        }
        // tslint:disable-next-line:no-non-null-assertion
        const text = clone.textContent!;
        const match = this.extractRef(text);
        if (match !== null) {
          refValue = match;
        }
      }

      if (refValue !== undefined) {
        cit.setAttribute("ref", refValue);
      }
      else {
        logger.warn(`no value for cit/@ref in title: ${title}`);
      }
    }

    let child = line.firstChild;

    // Convert <line> to <cit>. Remove <ref> and <page.number> and drop all
    // other tags (but keep their contents).
    //
    // We cannot immediately convert notvariant and normalised to word because
    // some of these elements may be part of the content unwrapped.
    //
    while (child !== null) {
      switch (child.nodeType) {
      case Node.TEXT_NODE:
        cit.appendChild(child.cloneNode(true));
        break;
      case Node.ELEMENT_NODE:
        const tagName = (child as Element).tagName;
        if (["ref", "page.number"].indexOf(tagName) !== -1) {
          // Do nothing: this effectively strips these elements and what they
          // contain.
        }
        else if (["notvariant", "normalised"].indexOf(tagName) !== -1) {
          cit.appendChild(child.cloneNode(true));
        }
        else {
          // This effectively unwraps the children.
          let grandChild = child.firstChild;
          while (grandChild !== null) {
            cit.appendChild(grandChild.cloneNode(true));
            grandChild = grandChild.nextSibling;
          }
        }
        break;
      default:
        break;
      }

      child = child.nextSibling;
    }

    return cit;
  }

  private checkCit(cit: Element, logger: Logger): void {
    // tslint:disable-next-line:no-non-null-assertion
    const text = cit.textContent!;
    if (/'\s/.test(text)) {
      logger.error(`errant avagraha in: ${cit.innerHTML}`);
    }
  }

  private convertMarkedToWord(doc: Document, cit: Element): void {
    // Convert <notvariant> and <normalised> to <word>.
    let elChild = cit.firstElementChild;
    while (elChild !== null) {
      const next = elChild.nextElementSibling;
      const tagName = elChild.tagName;
      if (tagName === "notvariant") {
        const word = doc.createElementNS(MMWP_NAMESPACE, "word");
        word.textContent = elChild.textContent;
        // tslint:disable-next-line:no-non-null-assertion
        word.setAttribute("lem", elChild.textContent!);
        cit.insertBefore(word, elChild);
      }
      else if (tagName === "normalised") {
        const word = doc.createElementNS(MMWP_NAMESPACE, "word");
        word.textContent = elChild.getAttribute("orig");
        // tslint:disable-next-line:no-non-null-assertion
        word.setAttribute("lem", elChild.textContent!);
        cit.insertBefore(word, elChild);
      }
      else {
        throw new Error(`unexpected element ${tagName}`);
      }

      cit.removeChild(elChild);
      elChild = next;
    }
  }

  /**
   * Perform a DOM normalization and clean the text of the node.
   */
  private cleanText(node: Node): void {
    node.normalize();
    this._cleanText(node);
  }

  /**
   * Perform the cleaning only. We separate this from [[cleanText]] because the
   * DOM normalization operation is already recursive and thus it is not useful,
   * in the context of this function, to *invoke* it recursively.
   */
  private _cleanText(node: Node): void {
    let child = node.firstChild;
    while (child !== null) {
      const next = child.nextSibling;
      switch (child.nodeType) {
      case Node.TEXT_NODE:
        // tslint:disable-next-line:no-non-null-assertion
        child.textContent = child.textContent!.replace(/\//g, "|");
        child.textContent = child.textContent.replace(/\*\*/g, "");
        child.textContent = child.textContent.replace(/\s*-[-\s]*/g, "-");
        child.textContent = child.textContent.replace(/\s+/g, " ");
        // The transformations can result in empty text nodes. Remove them. This
        // prevents denormalizing the text.
        if (child.textContent === "") {
          node.removeChild(child);
        }
        break;
      case Node.ELEMENT_NODE:
        this._cleanText(child);
        break;
      default:
        throw new Error(`unexpected node type: ${child.nodeType}`);
      }
      child = next;
    }
  }

  private breakIntoWords(doc: Document, cit: Element): void {
    // Break the text nodes into words to be wrapped in <word>.
    let child = cit.firstChild;
    while (child !== null) {
      const next = child.nextSibling;
      if (child.nodeType === Node.TEXT_NODE) {
        // Node containing only spaces, skip.
        // tslint:disable-next-line:no-non-null-assertion
        if (/^\s+$/.test(child.textContent!)) {
          child = next;
          continue;
        }

        // tslint:disable-next-line:no-non-null-assertion
        const parts = child.textContent!.split(/( )/);
        for (const part of parts) {
          if (part === "") {
            // Do nothing. This is created when we have a text node that starts
            // with a space or ends with a space.
          }
          else if (part === " ") {
            cit.insertBefore(doc.createTextNode(" "), child);
          }
          else {
            const compoundParts = part.split("-");
            if (compoundParts.length === 1) {
              const word = doc.createElementNS(MMWP_NAMESPACE, "word");
              word.textContent = part;
              cit.insertBefore(word, child);
            }
            else {
              for (let compoundPartsIx = 0;
                   compoundPartsIx < compoundParts.length;
                   ++compoundPartsIx) {
                const compoundPart = compoundParts[compoundPartsIx];

                // We skip the empty parts. After the processing done by earlier
                // steps, these may happen at the start or end of a part. It is
                // important that we don't just filter them out because they
                // affect the tests done on the index below.
                if (compoundPart === "") {
                  continue;
                }
                const word = doc.createElementNS(MMWP_NAMESPACE, "word");
                const text: string[] = [];
                if (compoundPartsIx !== 0) {
                  text.push("-");
                }
                text.push(compoundPart);
                if (compoundPartsIx !== compoundParts.length - 1) {
                  text.push("-");
                }
                word.textContent = text.join("");
                cit.insertBefore(word, child);
              }
            }
          }
        }

        cit.removeChild(child);
      }
      child = next;
    }
  }

  private cleanDashes(cit: Element, line: Element): void {
    // At this point we may have <word> elements that have a - at one end
    // without the corresponding - at the corresponding end in a sibling
    // word. We need to fix this.
    let elChild = cit.firstElementChild;
    while (elChild !== null) {
      const next = elChild.nextElementSibling;

      const tagName = elChild.tagName;
      if (tagName !== "word") {
        throw new Error(`unexpected element: ${tagName}`);
      }

      // tslint:disable-next-line:no-non-null-assertion
      const text = elChild.textContent!;
      if (text[text.length - 1] === "-") {
        if (next === null) {
          throw new Error(
            `word with trailing dash has no following sibling: \
${line.innerHTML}`);
        }

        // tslint:disable-next-line:no-non-null-assertion
        if (next.textContent![0] !== "-") {
          next.textContent = `-${next.textContent}`;
        }
      }
      else if (next !== null) {
        // tslint:disable-next-line:no-non-null-assertion
        if (next.textContent![0] === "-") {
          elChild.textContent = `${elChild.textContent}-`;
        }
      }

      if (text[0] === "-") {
        if (elChild.previousElementSibling === null) {
          throw new Error(
            `word with leading dash has no preceding sibling: \
${line.innerHTML}`);
        }
      }

      elChild = next;
    }
  }

  private wrapWordsInSentenceAndNumber(cit: Element): void {
    const s = cit.ownerDocument.createElementNS(MMWP_NAMESPACE, "s");
    // We create one sentence per cit and the numbering is scoped to cit so the
    // number is always 1.
    s.setAttribute("id", "1");

    // This wraps all children of cit in a <s>.
    let citChild = cit.firstChild;
    while (citChild !== null) {
      s.appendChild(citChild);
      citChild = cit.firstChild;
    }
    cit.appendChild(s);

    // Number the words.
    let id = 1;
    let word = s.firstElementChild;
    while (word !== null) {
      if (word.tagName === "word") {
        word.setAttribute("id", String(id++));
      }
      word = word.nextElementSibling;
    }
  }

  reportFailure(title: string, message: string): void {
    alert({
      title,
      message,
    });
  }

  private reportWarnings(message: string): void {
    alert({
      title: "Warning",
      message,
    });
  }
}
