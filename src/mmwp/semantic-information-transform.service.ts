import { Injectable } from "@angular/core";
import { alert } from "bootbox";
import { constructTree, Grammar } from "salve";
import { ParsingError, safeParse } from "salve-dom";
import { ModeValidator } from "wed";

import { ProcessingService } from "dashboard/processing.service";
import { fixPrototype, triggerDownload } from "dashboard/util";
import { XMLFile } from "dashboard/xml-file";
import { XMLTransformService } from "dashboard/xml-transform.service";
// tslint:disable-next-line:no-require-imports
import docAnnotated = require("./internal-schemas/doc-annotated");
// tslint:disable-next-line:no-require-imports
import semInfo = require("./internal-schemas/sem-info");
import { MMWPAValidator } from "./mmwpa-mode/mmwpa-validator";
import { validate } from "./util";

// tslint:disable-next-line:no-http-string
const MMWP_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/sem.info";

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

async function safeValidate(grammar: Grammar,
                            document: Document,
                            modeValidator?: ModeValidator): Promise<void> {
  const errors = await validate(grammar, document, modeValidator);
  if (errors.length !== 0) {
    throw new ProcessingError(
      "Validation Error",
      errors.map((x) => `<p>${x.error.toString()}</p>`).join("\n"));
  }
}

// We export it for the sake of testing.
export class Tuple {
  frequency: number = 1;

  constructor(readonly lem: string,
              readonly semField: string,
              readonly semCat: string) {}

  get key(): string {
    return [this.lem, this.semField, this.semCat].join(",");
  }

  equal(other: Tuple): boolean {
    return this.key === other.key;
  }

  compare(other: Tuple): -1 | 0 | 1 {
    const thisLem = this.lem;
    const otherLem = other.lem;

    if (thisLem !== otherLem) {
      return [thisLem, otherLem].sort()[0] === thisLem ? -1 : 1;
    }

    const diff = this.frequency - other.frequency;
    if (diff < 0) {
      return 1;
    }
    else if (diff > 0) {
      return -1;
    }

    // This is not required, but we further sort by sem.field and sem.cat to
    // have a predictable sorting in testing.
    const thisKey = this.key;
    const otherKey = other.key;
    if (this.key !== other.key) {
      return [thisKey, otherKey].sort()[0] === thisKey ? -1 : 1;
    }

    return 0;
  }
}

@Injectable()
export class SemanticInformationTransformService extends XMLTransformService {
  // Caches for the grammars. We do this at the class level because these
  // objects are immutable.
  private static _annotatedGrammar: Grammar | undefined;
  private static _semInfoGrammar: Grammar | undefined;

  constructor(private readonly processing: ProcessingService) {
    super("Extract semantic information to XML");
  }

  get annotatedGrammar(): Grammar {
    if (SemanticInformationTransformService._annotatedGrammar === undefined) {
      const clone = JSON.parse(JSON.stringify(docAnnotated));
      SemanticInformationTransformService._annotatedGrammar =
        constructTree(clone);
    }

    return SemanticInformationTransformService._annotatedGrammar;
  }

  get semInfoGrammar(): Grammar {
    if (SemanticInformationTransformService._semInfoGrammar === undefined) {
      const clone = JSON.parse(JSON.stringify(semInfo));
      SemanticInformationTransformService._semInfoGrammar =
        constructTree(clone);
    }

    return SemanticInformationTransformService._semInfoGrammar;
  }

  async perform(input: XMLFile): Promise<string> {
    let transformed: string;
    try {
      this.processing.start(1);
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

      await safeValidate(this.annotatedGrammar, doc,
                         new MMWPAValidator(doc));

      transformed = await this.transform(doc);
      triggerDownload(`${input.name.replace(/\..*?$/, "")}_sem_info.xml`,
                      transformed);
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
    return transformed;
  }

  async transform(doc: Document): Promise<string> {
    const outputDoc = safeParse(`<sem.info xmlns='${MMWP_NAMESPACE}'/>`);
    const words = Array.from(doc.getElementsByTagName("word"));
    const seen: Map<string, Tuple> = new Map();
    for (const word of words) {
      const lem = word.getAttribute("lem");
      const semCat = word.getAttribute("sem.cat");
      const semField = word.getAttribute("sem.field");

      if (semCat !== null || semField !== null) {
        const tuple = new Tuple(lem === null ? "" : lem,
                                semField === null ? "" : semField,
                                semCat === null ? "" : semCat);
        const key = tuple.key;
        const stored = seen.get(key);
        if (stored === undefined) {
          seen.set(key, tuple);
        }
        else {
          stored.frequency++;
        }
      }
    }

    const tuples = Array.from(seen.values()).sort((a, b) => a.compare(b));

    // tslint:disable-next-line:no-non-null-assertion
    const top = outputDoc.firstElementChild!;
    top.appendChild(outputDoc.createTextNode("\n"));
    for (const tuple of tuples) {
      const tupleEl = outputDoc.createElementNS(MMWP_NAMESPACE, "tuple");
      if (tuple.lem !== "") {
        tupleEl.setAttribute("lem", tuple.lem);
      }

      if (tuple.semField !== "") {
        tupleEl.setAttribute("sem.field", tuple.semField);
      }

      if (tuple.semCat !== "") {
        tupleEl.setAttribute("sem.cat", tuple.semCat);
      }

      tupleEl.setAttribute("freq", String(tuple.frequency));

      top.appendChild(tupleEl);
      top.appendChild(outputDoc.createTextNode("\n"));
    }

    await safeValidate(this.semInfoGrammar, outputDoc);

    return `${outputDoc.documentElement.outerHTML}\n`;
  }

  reportFailure(title: string, message: string): void {
    alert({
      title,
      message,
    });
  }
}
