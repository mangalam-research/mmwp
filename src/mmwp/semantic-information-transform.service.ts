import { Injectable } from "@angular/core";
import { constructTree, Grammar } from "salve";
import { safeParse } from "salve-dom";

import { ProcessingService } from "dashboard/processing.service";
import { XMLFile } from "dashboard/xml-file";

import { AnnotatedDocumentTransformService,
       } from "./annotated-document-transform.service";
// tslint:disable-next-line:no-require-imports
import semInfo = require("./internal-schemas/sem-info");
import { safeValidate } from "./util";

// tslint:disable-next-line:no-http-string
const MMWP_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/sem.info";

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
export class SemanticInformationTransformService
extends AnnotatedDocumentTransformService {
  // Caches for the grammars. We do this at the class level because these
  // objects are immutable.
  private static _semInfoGrammar: Grammar | undefined;

  constructor(processing: ProcessingService) {
    super(processing, "Extract semantic information to XML");
  }

  get semInfoGrammar(): Grammar {
    if (SemanticInformationTransformService._semInfoGrammar === undefined) {
      const clone = JSON.parse(JSON.stringify(semInfo));
      SemanticInformationTransformService._semInfoGrammar =
        constructTree(clone);
    }

    return SemanticInformationTransformService._semInfoGrammar;
  }

  protected getOutputName(input: XMLFile): string {
    return `${input.name.replace(/\..*?$/, "")}_sem_info.xml`;
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
}
