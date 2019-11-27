import { Grammar, readTreeFromJSON } from "salve";

import concordanceAnyVersion from "./internal-schemas/concordance-any-version";

// Cache for the grammar. We do this at the module level because this object is
// immutable.
let _concordanceGrammar: Grammar | undefined;

export function getConcordanceGrammar(): Grammar {
  if (_concordanceGrammar === undefined) {
    const clone = JSON.parse(JSON.stringify(concordanceAnyVersion));
    _concordanceGrammar = readTreeFromJSON(clone);
  }

  return _concordanceGrammar;
}
