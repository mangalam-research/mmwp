import { constructTree, Grammar } from "salve";
import { ErrorData, ParsingError, safeParse, WorkingState as WS,
         WorkingStateData } from "salve-dom";
import { ModeValidator, Validator } from "wed";

import { fixPrototype } from "dashboard/util";

// tslint:disable-next-line:no-require-imports
import docAnnotated = require("./internal-schemas/doc-annotated");
import { MMWPAValidator } from "./mmwpa-mode/mmwpa-validator";

export async function validate(grammar: Grammar,
                               doc: Document,
                               modeValidator?: ModeValidator):
Promise<ErrorData[]> {
  const validator =
    new Validator(grammar, doc,
                  modeValidator !== undefined ? [modeValidator] : []);
  const errors: ErrorData[] = [];
  return new Promise<ErrorData[]>((resolve) => {
    validator.events.addEventListener(
      "state-update",
      (state: WorkingStateData) => {
        if (!(state.state === WS.VALID || state.state === WS.INVALID)) {
          return;
        }

        resolve(errors);
      });
    validator.events.addEventListener("error", errors.push.bind(errors));
    validator.start();
  });
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

export async function safeValidate(grammar: Grammar,
                                   document: Document,
                                   modeValidator?: ModeValidator):
Promise<void> {
  const errors = await validate(grammar, document, modeValidator);
  if (errors.length !== 0) {
    throw new ProcessingError(
      "Validation Error",
      errors.map((x) => `<p>${x.error.toString()}</p>`).join("\n"));
  }
}

// We cache the grammar.
let _annotatedGrammar: Grammar | undefined;

export function getAnnotatedGrammar(): Grammar {
  if (_annotatedGrammar === undefined) {
    const clone = JSON.parse(JSON.stringify(docAnnotated));
    _annotatedGrammar = constructTree(clone);
  }

  return _annotatedGrammar;
}

export async function validateAnnotatedDocument(data: string):
Promise<Document> {
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

  await safeValidate(getAnnotatedGrammar(), doc, new MMWPAValidator(doc));
  return doc;
}
