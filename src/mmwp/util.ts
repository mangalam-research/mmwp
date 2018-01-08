import { Grammar } from "salve";
import { ErrorData, WorkingState as WS,
         WorkingStateData } from "salve-dom";

import { ModeValidator, Validator } from "wed";

// tslint:disable-next-line:no-http-string
export const MMWP_NAMESPACE = "http://mangalamresearch.org/ns/mmwp/doc";

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
