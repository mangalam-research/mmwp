import { Injectable } from "@angular/core";

import { ProcessingService } from "dashboard/processing.service";
import { XMLFile } from "dashboard/xml-file";

import { AnnotatedDocumentTransformService,
       } from "./annotated-document-transform.service";
import { getText } from "./mmwpa-mode/util";

export class Word {
  public prev: Word | null = null;
  public next: Word | null = null;
  constructor(public readonly el: Element) {}

  /**
   * Populate the fields prev and next.
   */
  link(map: Record<string, Word>): void {
    const prev = this.el.previousElementSibling;
    if (prev !== null) {
      // tslint:disable-next-line:no-non-null-assertion
      this.prev = map[prev.getAttribute("id")!];
    }

    const next = this.el.nextElementSibling;
    if (next !== null) {
      // tslint:disable-next-line:no-non-null-assertion
      this.next = map[next.getAttribute("id")!];
    }
  }

  get id(): string {
    const id = this.el.getAttribute("id");
    if (id === null) {
      throw new Error("no id available; this should not happen");
    }

    return id;
  }

  get text(): string {
    return getText(this.el);
  }

  get nextRaw(): string {
    const text = this.text;
    if (text[text.length - 1] === "-") {
      // tslint:disable-next-line:no-non-null-assertion
      return text.slice(0, text.length - 1) + this.next!.nextRaw;
    }

    return text;
  }

  get prevRaw(): string {
    const text = this.text;
    if (text[0] === "-") {
      // tslint:disable-next-line:no-non-null-assertion
      return this.prev!.prevRaw + text.slice(1);
    }

    return text;
  }

  get raw(): string | undefined {
    const text = this.text;
    const withPrev = text[0] === "-";
    const withNext = text[text.length - 1] === "-";
    if (withPrev || withNext) {
      if (withPrev && !withNext) {
        return this.prevRaw;
      }
      else if (!withPrev && withNext) {
        return this.nextRaw;
      }
      else {
        // tslint:disable-next-line:no-non-null-assertion
        return this.prev!.prevRaw + text.slice(1, text.length - 1) +
          // tslint:disable-next-line:no-non-null-assertion
          this.next!.nextRaw;
      }
    }

    return "";
  }

  getAttribute(name: string): string {
    const ret = this.el.getAttribute(name);
    return ret === null ? "" : ret;
  }
}

@Injectable()
export class CoNLLTransformService extends AnnotatedDocumentTransformService {
  constructor(processing: ProcessingService) {
    super(processing, "Annotated document to CoNLL");
  }

  protected getOutputName(input: XMLFile): string {
    return input.name.replace(/\.xml$/, ".txt");
  }

  protected async transform(doc: Document): Promise<string> {
    let buf: string = "";
    const docEl = doc.getElementsByTagName("doc")[0].cloneNode() as Element;

    // We take advantage of the DOM's serialization machinery to produce the
    // opening tag. However, we need to drop the closing tag or transform the
    // empty tag into non-empty to serve our purpose here.
    const docXML = docEl.outerHTML.replace(/<\/doc>$/, "").replace(/\/>$/, ">");
    buf += `${docXML}\n`;

    const sEls = doc.getElementsByTagName("s");
    for (const sEl of Array.prototype.slice.call(sEls)) {
      buf += "<s>\n";
      const wordEls = sEl.getElementsByTagName("word");
      const words = [];
      const idToWord: Record<string, Word> = Object.create(null);
      for (const wordEl of Array.prototype.slice.call(wordEls)) {
        const word = new Word(wordEl);
        words.push(word);
        idToWord[word.id] = word;
      }

      for (const word of words) {
        word.link(idToWord);
      }

      for (const word of words) {
        buf += `${word.id}\t`;
        buf += `${word.text}\t`;
        buf += `${word.raw}\t`;
        buf += `${word.getAttribute("lem")}\t`;
        buf += `${word.getAttribute("case")}\t`;
        buf += `${word.getAttribute("number")}\t`;
        buf += `${word.getAttribute("sem.cat")}\t`;
        buf += `${word.getAttribute("sem.field")}\t`;
        buf += `${word.getAttribute("uncertainty")}\t`;
        buf += `${word.getAttribute("conc.rel")}\t`;
        buf += `${word.getAttribute("conc.head")}\t`;
        buf += `${word.getAttribute("sem.role")}\t`;
        buf += `${word.getAttribute("dep.rel")}\t`;
        buf += `${word.getAttribute("dep.head")}\n`;
      }
      buf += "</s>\n";
    }
    buf += "</doc>\n";

    return buf;
  }
}
