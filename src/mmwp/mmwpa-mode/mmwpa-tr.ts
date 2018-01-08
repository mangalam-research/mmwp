/**
 * Transformations for MMWPA mode.
 * @author Louis-Dominique Dubeau
 */

import { domtypeguards, domutil, EditorAPI, exceptions, Modal,
         transformation, UndoMarker } from "wed";
import isElement = domtypeguards.isElement;
import isText = domtypeguards.isText;
import textToHTML = domutil.textToHTML;
import AbortTransformationException = exceptions.AbortTransformationException;
import TransformationData = transformation.TransformationData;

import { isValidCompound, setLemFromPart,
         wordsFromCompoundParts } from "../compounds";

export class WordNumberingMarker extends UndoMarker {
  constructor() {
    super("WordNumberingMarker");
  }
}

const MODE_KEY = "mmwpa-mode";

function makeModalGetter(key: string, builder: (modal: Modal) => void):
(editor: EditorAPI) => Modal {
  const fullKey = `${MODE_KEY}.${key}`;
  return (editor: EditorAPI) => {
    let modal: Modal = editor.getModeData(fullKey);
    if (modal != null) {
      return modal;
    }

    modal = editor.makeModal();
    builder(modal);
    editor.setModeData(fullKey, modal);
    return modal;
  };
}

const getNumberSentenceModal = makeModalGetter(
  "number-sentence-modal",
  (modal) => {
    modal.setTitle("Invalid");
    modal.addButton("Ok", true);
  });

export const getRenumberModal = makeModalGetter(
  "renumber-modal",
  (modal) => {
    modal.setTitle("Check references");
    modal.setBody(`The words of the sentence in which the caret is located \
were renumbered. Check @dep.head and @conc.head for correctness on each word \
of this sentence.`);
    modal.addButton("Ok", true);
  });

export function numberSentences(editor: EditorAPI,
                                data: TransformationData): void {
  const node = data.node as Element;
  let child = node.firstChild;
  let error = null;
  while (child !== null) {
    if (isText(child)) {
      if (child.data.trim() !== "") {
        error = `there is text outside of a sentence: ${child.data}`;
        break;
      }
    }
    else if (isElement(child)) {
      if (child.tagName !== "s") {
        error = `there is an element outside of a sentence: \
${textToHTML(child.outerHTML)}`;
        break;
      }
    }
    else {
      throw new Error(`unknown type of child: ${child.nodeType}`);
    }
    child = child.nextSibling;
  }

  if (error !== null) {
    const modal = getNumberSentenceModal(editor);
    modal.setBody(`<p>The sentences cannot be numbered because ${error}.</p>`);
    modal.modal();
    throw new AbortTransformationException("cit content is invalid");
  }

  let id = 1;
  child = node.firstChild;
  while (child !== null) {
    if (isElement(child)) {
      editor.dataUpdater.setAttribute(child, "id", String(id++));
    }
    child = child.nextSibling;
  }
}

function checkForNumbering(editor: EditorAPI, sentence: Element,
                           disallowID: boolean): void {
  let child = sentence.firstChild;
  let error = null;

  while (child !== null) {
    if (isText(child)) {
      if (child.data.trim() !== "") {
        error = `there is text outside of a word: ${child.data}`;
        break;
      }
    }
    else if (isElement(child)) {
      if (child.tagName !== "word") {
        error = `there is a foreign element: ${textToHTML(child.outerHTML)}`;
        break;
      }
      else if (disallowID && (child.getAttribute("id") !== null)) {
        error = `there is a word with number ${child.getAttribute("id")}`;
      }
    }
    else {
      throw new Error(`unknown type of child: ${child.nodeType}`);
    }
    child = child.nextSibling;
  }

  if (error !== null) {
    const modal = getNumberSentenceModal(editor);
    modal.setBody(`<p>The words cannot be numbered because ${error}.</p>`);
    modal.modal();
    throw new AbortTransformationException("sentence content is invalid");
  }
}

export function numberWords(editor: EditorAPI, data: TransformationData): void {
  const sentence = data.node as Element;
  checkForNumbering(editor, sentence, true);

  let id = 1;
  let child = sentence.firstChild;
  while (child !== null) {
    if (isElement(child)) {
      editor.dataUpdater.setAttribute(child, "id", String(id++));
    }
    child = child.nextSibling;
  }
}

// The code here does not keep track of changes made and automatically renumber
// conc.head and dep.head. This is a choice we made to minimize code complexity.
export function renumberWords(editor: EditorAPI, sentence: Element): void {
  checkForNumbering(editor, sentence, false);

  let id = 1;
  let child = sentence.firstChild;
  let changed = false;
  let headAttributesPresent = false;
  while (child !== null) {
    if (isElement(child)) {
      const newId = String(id++);
      // We do not want to trigger a change if the values are the same.
      if (newId !== child.getAttribute("id")) {
        changed = true;
        editor.dataUpdater.setAttribute(child, "id", newId);
      }

      if (child.hasAttribute("conc.head") || child.hasAttribute("dep.head")) {
        headAttributesPresent = true;
      }
    }
    child = child.nextSibling;
  }

  // We don't bring up the modal in cases where it would be spurious.
  if (changed && headAttributesPresent) {
    // We drop a marker into the list of undo objects so that we can later
    // bring up the same modal if the user undoes/redoes the change we just
    // made.
    editor.recordUndo(new WordNumberingMarker());
    getRenumberModal(editor).modal();
  }
}

export function numberSentencesAndWords(editor: EditorAPI,
                                        data: TransformationData): void {
  numberSentences(editor, data);
  const node = data.node as Element;
  let child = node.firstChild;
  while (child !== null) {
    if (!isElement(child) || child.tagName !== "s") {
      throw new Error(
        "unexpected state; numberSentences should not allow this");
    }
    numberWords(editor, { name: "s", node: child });
    child = child.nextSibling;
  }
}

export function unnumberWords(editor: EditorAPI,
                              data: TransformationData): void {
  const node = data.node as Element;
  let child = node.firstChild;

  child = node.firstChild;
  while (child !== null) {
    if (isElement(child) && child.tagName === "word") {
      editor.dataUpdater.setAttribute(child, "id", null);
    }
    child = child.nextSibling;
  }
}

const getSplitCompoundModal = makeModalGetter(
  "split-compound-modal",
  (modal) => {
    modal.setTitle("Split compound into parts");
    modal.setBody(`The word is not in a correct format for splitting. \
Make sure there are no XML elements inside the word. And that there is no \
leading or trailing dash and that the dashes that mark part boundaries are \
single dashes (not double or triple)`);
    modal.addButton("Ok", true);
  });

export function splitCompoundIntoParts(editor: EditorAPI,
                                       data: TransformationData): void {
  const node = data.node as Element;
  if (node.tagName !== "word") {
    throw new Error("unexpected state: not working on a word");
  }

  if (node.firstElementChild !== null || !isValidCompound(node)) {
    getSplitCompoundModal(editor).modal();
    throw new AbortTransformationException("invalid word format");
  }

  // tslint:disable-next-line:no-non-null-assertion
  const parts = node.textContent!.split("-");
  if (parts.length === 1) {
    return;
  }

  for (const word of wordsFromCompoundParts(parts, node.ownerDocument)) {
    setLemFromPart(word);
    editor.dataUpdater.insertBefore(node.parentNode as Element, word, node);
  }

  editor.dataUpdater.removeNode(node);
}
