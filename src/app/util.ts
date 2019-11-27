import { Grammar, readTreeFromJSON } from "salve";
import { ErrorData, ParsingError, safeParse, Validator as BaseValidator,
         WorkingState as WS, WorkingStateData } from "salve-dom";
import { ModeValidator } from "wed";

import { fixPrototype } from "wed-demo-lib";

import docAnnotated from "./internal-schemas/doc-annotated";
import { MMWPAValidator } from "./mmwpa-mode/mmwpa-validator";

class Validator extends BaseValidator {
  constructor(schema: Grammar, root: Element | Document,
              private readonly modeValidator?: ModeValidator) {
    super(schema, root, {
      timeout: 0,
      maxTimespan: 100,
    });
  }

  _runDocumentValidation(): void {
    if (this.modeValidator === undefined) {
      return;
    }

    for (const error of this.modeValidator.validateDocument()) {
      this._processError(error);
    }
  }
}

export async function validate(grammar: Grammar,
                               doc: Document,
                               modeValidator?: ModeValidator):
Promise<ErrorData[]> {
  const validator = new Validator(grammar, doc, modeValidator);
  const errors: ErrorData[] = [];
  return new Promise<ErrorData[]>(resolve => {
    validator.events.addEventListener(
      "state-update",
      (state: WorkingStateData) => {
        if (!(state.state === WS.VALID || state.state === WS.INVALID)) {
          return;
        }

        resolve(errors);
      });
    validator.events.addEventListener("error", error => {
      errors.push(error);
    });
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
      errors.map(x => `<p>${x.error.toString()}</p>`).join("\n"));
  }
}

// We cache the grammar.
let _annotatedGrammar: Grammar | undefined;

export function getAnnotatedGrammar(): Grammar {
  if (_annotatedGrammar === undefined) {
    const clone = JSON.parse(JSON.stringify(docAnnotated));
    _annotatedGrammar = readTreeFromJSON(clone);
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

export function splitOnExt(name: string): [string, string] {
  const lastDot = name.lastIndexOf(".");
  return lastDot === -1 ? [ name, "" ] : [ name.substring(0, lastDot),
                                           name.substring(lastDot + 1) ];
}
