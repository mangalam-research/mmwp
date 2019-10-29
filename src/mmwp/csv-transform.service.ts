import { Injectable } from "@angular/core";

import { ProcessingService } from "dashboard/processing.service";
import { XMLFile } from "dashboard/xml-file";

import { AnnotatedDocumentCSVRenderer } from "./annotated-document-csv";
import { AnnotatedDocumentTransformService,
       } from "./annotated-document-transform.service";
import { CSVDocument, CSVRow } from "./csv";

// We use assertions too much in this file to let this be an error.
/* tslint:disable:no-non-null-assertion */

const RELATION_ATTRIBUTES: readonly string[] =
  ["case", "number", "sem.cat", "sem.field", "sem.pros", "sem.role",
   "uncertainty"];

interface Relation {
  name: string;
  reverse?: Relation;
}

type TreeKind = "dep" | "conc";

class TreeSpec {
  readonly relationAttrName: string;
  readonly headAttrName: string;
  readonly relations: readonly Relation[];
  readonly knownRelations: ReadonlySet<string>;
  readonly columnNames: readonly string[];

  constructor(kind: TreeKind,
              spec: readonly ([string, string] | [string])[]) {
    this.relationAttrName = `${kind}.rel`;
    this.headAttrName = `${kind}.head`;

    const knownRelations = new Set<string>();
    const relations: Relation[] = [];
    for (const [a, b] of spec) {
      knownRelations.add(a);
      const first: Relation = { name: a };
      relations.push(first);
      if (b !== undefined) {
        knownRelations.add(b);
        const second = { name: b, reverse: first };
        first.reverse = second;
        relations.push(second);
      }
    }
    this.relations = relations;
    this.knownRelations = knownRelations;

    const columnNames: string[] = [];
    for (const relation of knownRelations) {
      columnNames.push(relation);
      for (const attr of RELATION_ATTRIBUTES) {
        columnNames.push(`${relation}.${attr}`);
      }
    }

    this.columnNames = columnNames;
  }
}

const kindToSpec: Record<TreeKind, TreeSpec> = {
  dep: new TreeSpec("dep", [["modifies", "modified.by"],
                            ["glossing", "glossed.by"],
                            ["takes.oblique", "oblique.of"],
                            ["takes.as.subject.agent", "subject.agent"],
                            ["takes.as.object.patient", "object.patient"],
                            ["manner.of", "takes.manner"],
                            ["clausal.of", "takes.clausal"],
                            ["listed.with"],
                            ["contrasted.with"],
                            ["dep"],
                            ["parallel.to"]]),
  conc: new TreeSpec("conc", [["leading.to", "caused.by"],
                              ["possessing", "belonging.to"],
                              ["locus.of", "located.in"],
                              ["by.means.of", "achieved.through"],
                              ["goal.of", "takes.goal"],
                              ["equal"],
                              ["while"]]),
};

function inverse(relation: Relation): Relation {
  return (relation.reverse !== undefined) ? relation.reverse : relation;
}

export const COLUMN_NAMES: readonly string[] = [
  "id",
  "sentenceID",
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
  "lemma.compounded",
  ...kindToSpec["dep"].columnNames,
  ...kindToSpec["conc"].columnNames,
  "csvCreationDateTime",
  "csvFormatVersion"];

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

function getWithDefault<R>(mapping: R,
                           key: keyof R,
                           defaultValue: new () => R[typeof key]):
R[typeof key] {
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
    this.fillRelationColumns("dep", occurrence, row);
    this.fillRelationColumns("conc", occurrence, row);
    this.fillBookkepingColumns(creationDateTime.toISOString(), row);
  }

  fillStartColumns(rowId: string, titleInfo: TitleInfo, cit: Element,
                   occurrence: Element, row: CSVRow): void {
    row.setColumn("id", rowId);
    row.setColumn("sentenceID", getNecessaryAttribute(cit, "sid"));
    row.setColumn("lemma", getNecessaryAttribute(occurrence, "lem"));
    for (const field of TITLE_INFO_KEYS) {
      row.setColumn(field, titleInfo[field]);
    }
    row.setColumn("ref", getAttribute(cit, "ref"));
  }

  fillCotextColumns(cit: Element, occurrence: Element, row: CSVRow): void {
    const citationWords = Array.from(cit.getElementsByTagName("word"))
      .filter(x => x !== occurrence);

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
      const additional = ["tr", "p"].map(x => getAttribute(tr, x))
        .filter(x => x !== "").join(" ");
      const columnText = additional !== "" ?
        `${tr.textContent!} [${additional}]` :
        tr.textContent!;

      row.setColumn("translation", columnText);
    }

    row.setColumn("citation", citWithoutTr.textContent!);
  }

  fillRelationColumns(kind: TreeKind, occurrence: Element, row: CSVRow): void {
    const spec = kindToSpec[kind];
    if (spec === undefined) {
      throw new Error(`unknown tree kind ${kind}`);
    }

    const { relationAttrName, headAttrName, relations, knownRelations } = spec;

    const sentence = occurrence.closest("s")!;
    const sentenceWords = Array.from(sentence.getElementsByTagName("word"))
      .filter(x => x !== occurrence);

    const relToWords: Record<string, Set<Element>> = Object.create(null);
    const headToWords: Record<string, Set<Element>> = Object.create(null);
    const idToWord: Record<string, Element> = Object.create(null);

    for (const word of sentenceWords) {
      let rel = word.getAttribute(relationAttrName)!;
      if (rel !== null) {
        rel = rel.trim();
        if (!knownRelations.has(rel)) {
          throw new Error(`unknown relation: ${rel}`);
        }

        getWithDefault(relToWords, rel, Set).add(word);
      }

      const head = word.getAttribute(headAttrName)!;
      if (head !== null) {
        getWithDefault(headToWords, head.trim(), Set).add(word);
      }

      const id = getNecessaryAttribute(word, "id");
      if (idToWord[id] !== undefined) {
        throw new Error("internal error: duplicate word id");
      }
      idToWord[id] = word;
    }

    const occurrenceId = getNecessaryAttribute(occurrence, "id");
    const occurenceRel = getAttribute(occurrence, relationAttrName);
    if (occurenceRel !== "" && !knownRelations.has(occurenceRel)) {
      throw new Error(`unknown relation: ${occurenceRel}`);
    }
    let occurrenceHead = occurrence.getAttribute(headAttrName);
    if (occurrenceHead !== null) {
        occurrenceHead = occurrenceHead.trim();
    }
    for (const relation of relations) {
      // From the design document, this is:
      //
      // ancestor::s/word[@dep.rel = $inverse($V) and
      //                  @dep.head = $occurrence/@id]
      const relevantWords =
        new Set([...
                 Array.from(getWithDefault(headToWords, occurrenceId,
                                           Set as new () => Set<Element>))]
                .filter(x => getWithDefault(relToWords,
                                            inverse(relation).name,
                                            Set).has(x)));

      // if @dep.rel = $V, ancestor::s/word[@id=$occurrence/@dep.head]/@lem
      if (occurrenceHead !== null && occurenceRel === relation.name) {
        relevantWords.add(idToWord[occurrenceHead]);
      }

      const relevantWordsArray = Array.from(relevantWords);
      const lems = relevantWordsArray
        .map(x => getAttribute(x, "lem"))
        .filter(x => x !== "").join(";;");
      row.setColumn(relation.name, lems);

      for (const attribute of RELATION_ATTRIBUTES) {
        const values = relevantWordsArray
          .map(x => getAttribute(x, attribute))
          .filter(x => x !== "").join(";;");
        row.setColumn(`${relation.name}.${attribute}`, values);
      }
    }
  }

  fillBookkepingColumns(creationDateTime: string, row: CSVRow): void {
    row.setColumn("csvCreationDateTime", creationDateTime);
    row.setColumn("csvFormatVersion", "1");
  }
}
