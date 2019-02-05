import { Injectable } from "@angular/core";

import { ProcessingService } from "dashboard/processing.service";
import { XMLFile } from "dashboard/xml-file";

import { AnnotatedDocumentCSVRenderer } from "./annotated-document-csv";
import { AnnotatedDocumentTransformService,
       } from "./annotated-document-transform.service";
import { CSVDocument, CSVRow } from "./csv";

// We use assertions too much in this file to let this be an error.
/* tslint:disable:no-non-null-assertion */

interface Relation {
  name: string;
  reverse?: Relation;
}

const RELATIONS: Relation[] = [];

for (const [a, b] of [["modifies", "modified.by"],
                      ["glossing", "glossed.by"],
                      ["takes.oblique", "oblique.of"],
                      ["takes.as.subject.agent", "subject.agent"],
                      ["takes.as.object.patient", "object.patient"],
                      ["manner.of", "takes.manner"],
                      ["clausal.of", "takes.clausal"]]) {
  const first: Relation = { name: a };
  const second = { name: b, reverse: first };
  first.reverse = second;
  RELATIONS.push(first, second);
}

for (const name of ["listed.with", "contrasted.with", "dep", "parallel.to"]) {
  RELATIONS.push({ name });
}

const KNOWN_RELATIONS = new Set(RELATIONS.map((x) => x.name));

function inverse(relation: Relation): Relation {
  return (relation.reverse !== undefined) ? relation.reverse : relation;
}

const RELATION_ATTRIBUTES: string[] =
  ["case", "number", "sem.cat", "sem.field", "sem.pros", "sem.role",
   "uncertainty"];

export const COLUMN_NAMES: string[] = [
  "id",
  "lemma",
  "title",
  "genre",
  "author",
  "tradition",
  "school",
  "period",
  "ref",
  "citation",
  "translation",
  "cotext",
  "cotextSemField",
  "lemma.case",
  "lemma.number",
  "lemma.sem.cat",
  "lemma.sem.field",
  "lemma.sem.role",
  "lemma.sem.pros",
  "lemma.uncertainty",
  "lemma.compounded"];

for (const relation of RELATIONS) {
  COLUMN_NAMES.push(relation.name);
  for (const attr of RELATION_ATTRIBUTES) {
    COLUMN_NAMES.push(`${relation.name}.${attr}`);
  }
}

COLUMN_NAMES.push("csvCreationDateTime", "csvFormatVersion");

export interface TitleInfo {
  title: string;
  genre: string;
  author: string;
  tradition: string;
  school: string;
  period: string;
}

const EMPTY_TITLE_INFO: TitleInfo = {
  title: "",
  genre: "",
  author: "",
  tradition: "",
  school: "",
  period: "",
};

const TITLE_INFO_KEYS = Object.keys(EMPTY_TITLE_INFO) as (keyof TitleInfo)[];

function getAttribute(el: Element, name: string): string {
  const value = el.getAttribute(name);
  return value === null ? "" : value.trim();
}

function getNecessaryAttribute(el: Element, name: string): string {
  const value = el.getAttribute(name);
  if (value === null) {
    throw new Error(`trying to get unset attribute ${name} from an element \
with tag name ${el.tagName}`);
  }
  return value.trim();
}

function getWithDefault<X, R extends Record<string, X>>(
  mapping: R,
  key: string,
  defaultValue: new () => X): X {
  let ret = mapping[key];
  if (ret === undefined) {
    ret = mapping[key] = new defaultValue();
  }

  return ret;
}

@Injectable()
export class CSVTransformService extends AnnotatedDocumentTransformService {
  constructor(processing: ProcessingService) {
    super(processing, "Annotated document to CSV", "application/text");
  }

  getOutputName(input: XMLFile): string {
    return input.name.replace(/(\..*)?$/, ".csv");
  }

  async transform(doc: Document): Promise<string> {
    const top = doc.firstElementChild!;
    const lemma = getNecessaryAttribute(top, "lem");
    const titleInfo: TitleInfo = {
      title: getNecessaryAttribute(top, "title"),
      genre: getNecessaryAttribute(top, "genre"),
      author: getNecessaryAttribute(top, "author"),
      tradition: getNecessaryAttribute(top, "tradition"),
      school: getNecessaryAttribute(top, "school"),
      period: getNecessaryAttribute(top, "period"),
    };

    const cognates = top.getAttribute("lemCognates");
    const selectedLemmas = new Set(cognates !== null ?
                                   [lemma, ...cognates.split(/\s+/)] : [lemma]);

    const csv = new CSVDocument(COLUMN_NAMES);
    const allWords = doc.getElementsByTagName("word");
    const date = new Date();
    for (const word of Array.from(allWords)) {
      let lem = word.getAttribute("lem");
      if (lem !== null) {
        lem = lem.trim();
        if (selectedLemmas.has(lem)) {
          const row = csv.makeRow();
          const cit = word.closest("cit");
          if (cit === null) {
            throw new Error("unexpected document structure: word not in cit");
          }
          const id = getNecessaryAttribute(cit, "id");

          const rowId = `${titleInfo.title}${lem}${id}`;
          this.fillRow(date, rowId, titleInfo, cit, word, row);
        }
      }
    }

    return new AnnotatedDocumentCSVRenderer({
      placeholder: "",
    }).render(csv);
  }

  fillRow(creationDateTime: Date, rowId: string, titleInfo: TitleInfo,
          cit: Element, occurrence: Element, row: CSVRow): void {
    this.fillStartColumns(rowId, titleInfo, cit, occurrence, row);
    this.fillCitationTranslationColumns(cit, row);
    this.fillCotextColumns(cit, occurrence, row);
    this.fillAttributeColumns(occurrence, row);
    this.fillRelationColumns(occurrence, row);
    this.fillBookkepingColumns(creationDateTime.toISOString(), row);
  }

  fillStartColumns(rowId: string, titleInfo: TitleInfo, cit: Element,
                   occurrence: Element, row: CSVRow): void {
    row.setColumn("id", rowId);
    row.setColumn("lemma", getNecessaryAttribute(occurrence, "lem"));
    for (const field of TITLE_INFO_KEYS) {
      row.setColumn(field, titleInfo[field]);
    }
    row.setColumn("ref", getAttribute(cit, "ref"));
  }

  fillCotextColumns(cit: Element, occurrence: Element, row: CSVRow): void {
    const citationWords = Array.from(cit.getElementsByTagName("word"))
      .filter((x) => x !== occurrence);

    let cotext = "";
    let cotextSemField = "";

    for (const sibling of citationWords) {
      const lem = sibling.getAttribute("lem");
      if (lem !== null) {
        cotext += `;;${lem.trim()}`;
      }
      const semField = sibling.getAttribute("sem.field");
      if (semField !== null) {
        cotextSemField += `;;${semField.trim()}`;
      }
    }

    row.setColumn("cotext", cotext.substr(2));
    row.setColumn("cotextSemField", cotextSemField.substr(2));
  }

  fillAttributeColumns(occurrence: Element, row: CSVRow): void {
    for (const attrName of ["case", "number", "sem.cat", "sem.field",
      "sem.role", "sem.pros", "uncertainty"]) {
      row.setColumn(`lemma.${attrName}`, getAttribute(occurrence, attrName));
    }
    const compounded = occurrence.textContent!.indexOf("-") !== -1;
    row.setColumn("lemma.compounded", compounded ? "YES" : "NO");
  }

  fillCitationTranslationColumns(cit: Element, row: CSVRow): void {
    const citWithoutTr = cit.cloneNode(true) as Element;
    const trs = citWithoutTr.getElementsByTagName("tr");
    if (trs.length > 1) {
      throw new Error("unexpected structure: more than one tr in cit");
    }

    const tr = trs[0];
    if (tr !== undefined) {
      tr.parentNode!.removeChild(tr);
      row.setColumn("translation", tr.textContent!);
    }

    row.setColumn("citation", citWithoutTr.textContent!);
  }

  fillRelationColumns(occurrence: Element, row: CSVRow): void {
    const sentence = occurrence.closest("s")!;
    const sentenceWords = Array.from(sentence.getElementsByTagName("word"))
      .filter((x) => x !== occurrence);

    const depRelToWords: Record<string, Set<Element>> = Object.create(null);
    const depHeadToWords: Record<string, Set<Element>> = Object.create(null);
    const idToWord: Record<string, Element> = Object.create(null);

    for (const word of sentenceWords) {
      let depRel = word.getAttribute("dep.rel")!;
      if (depRel !== null) {
        depRel = depRel.trim();
        if (!KNOWN_RELATIONS.has(depRel)) {
          throw new Error(`unknown relation: ${depRel}`);
        }

        getWithDefault(depRelToWords, depRel, Set).add(word);
      }

      let depHead = word.getAttribute("dep.head")!;
      if (depHead !== null) {
        depHead = depHead.trim();
        getWithDefault(depHeadToWords, depHead, Set).add(word);
      }

      const id = getNecessaryAttribute(word, "id");
      if (idToWord[id] !== undefined) {
        throw new Error("internal error: duplicate word id");
      }
      idToWord[id] = word;
    }

    const occurrenceId = getNecessaryAttribute(occurrence, "id");
    const occurenceDepRel = getAttribute(occurrence, "dep.rel");
    if (occurenceDepRel !== "" && !KNOWN_RELATIONS.has(occurenceDepRel)) {
      throw new Error(`unknown relation: ${occurenceDepRel}`);
    }
    let occurrenceDepHead = occurrence.getAttribute("dep.head");
    if (occurrenceDepHead !== null) {
        occurrenceDepHead = occurrenceDepHead.trim();
    }
    for (const relation of RELATIONS) {
      // From the design document, this is:
      //
      // ancestor::s/word[@dep.rel = $inverse($V) and
      //                  @dep.head = $occurrence/@id]
      const relevantWords =
        new Set([...
                 Array.from(getWithDefault(depHeadToWords, occurrenceId,
                                           Set as new () => Set<Element>))]
                .filter((x) => getWithDefault(depRelToWords,
                                              inverse(relation).name,
                                              Set).has(x)));

      // if @dep.rel = $V, ancestor::s/word[@id=$occurrence/@dep.head]/@lem
      if (occurrenceDepHead !== null && occurenceDepRel === relation.name) {
        relevantWords.add(idToWord[occurrenceDepHead]);
      }

      const relevantWordsArray = Array.from(relevantWords);
      const lems = relevantWordsArray
        .map((x) => getAttribute(x, "lem"))
        .filter((x) => x !== "").join(";;");
      row.setColumn(relation.name, lems);

      for (const attribute of RELATION_ATTRIBUTES) {
        const values = relevantWordsArray
          .map((x) => getAttribute(x, attribute))
          .filter((x) => x !== "").join(";;");
        row.setColumn(`${relation.name}.${attribute}`, values);
      }
    }
  }

  fillBookkepingColumns(creationDateTime: string, row: CSVRow): void {
    row.setColumn("csvCreationDateTime", creationDateTime);
    row.setColumn("csvFormatVersion", "1");
  }
}
