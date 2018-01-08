import { MMWP_NAMESPACE } from "./util";

/**
 * Verify that a word is in the proper format for a compound. This function is
 * used when editing XML files to make sure the user is acting on something
 * sensible.
 *
 * @param word The word to process.
 *
 * @returns ``true`` if valid, ``false`` otherwise.
 */
export function isValidCompound(word: Node): boolean {
  // tslint:disable-next-line:no-non-null-assertion
  const text = word.textContent!;
  // A compound may not be an empty string, or start with a dash, end with a
  // dash or contain multiple dashes in a row.
  return text.length > 0 && text[0] !== "-" && text[text.length - 1] !== "-" &&
    text.search("--") === -1;
}

export function wordsFromCompoundParts(parts: string[],
                                       doc: Document): Element[] {
  const words: Element[] = [];
  const lastIx = parts.length - 1;
  for (let partsIx = 0; partsIx < parts.length; ++partsIx) {
    const part = parts[partsIx];

    // We skip the empty parts, as this may occur during the transformation of
    // concordance files. After the processing done by earlier steps, these may
    // happen at the start or end of a part. It is important that we don't just
    // filter them out because they affect the tests done on the index below.
    if (part === "") {
      continue;
    }
    const word = doc.createElementNS(MMWP_NAMESPACE, "word");
    word.textContent =
      `${partsIx !== 0 ? "-" : ""}${part}${partsIx !== lastIx ? "-" : ""}`;
    words.push(word);
  }

  return words;
}

/**
 * Set ``@lem`` on a ``<word>`` element if ``@lem`` is not already set and the
 * word happens to contain a non-final compound part. The word must have be
 * processed already to split compound parts into individual ``<word>``
 * elements.
 *
 * @param word The word to process.
 */
export function setLemFromPart(word: Element): void {
  // We don't set @lem, if it is already set by previous processing.
  if (word.getAttribute("lem") !== null) {
    return;
  }

  // tslint:disable-next-line:no-non-null-assertion
  const text = word.textContent!;
  // If the word ends with a dash, it is part of a compound but not the final
  // part, which is what we want. Otherwise, we can't do anything to it.
  if (!text.endsWith("-")) {
    return;
  }

  // Populate @lem, without the final dash, and without the possible initial
  // one.
  word.setAttribute("lem", text.slice(0, -1).replace(/^-/, ""));
}
