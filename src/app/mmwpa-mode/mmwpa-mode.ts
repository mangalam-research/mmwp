import { action, domtypeguards, domutil, EditorAPI, exceptions, ModeValidator,
         objectCheck, transformation, util } from "wed";
import isText = domtypeguards.isText;
import AbortTransformationException = exceptions.AbortTransformationException;
import Transformation = transformation.Transformation;
import Action = action.Action;

import * as generic from "wed/modes/generic/generic";

import { MMWPAMetadata } from "./mmwpa-metadata";
import * as mmwpaTr from "./mmwpa-tr";
import { MMWPAValidator } from "./mmwpa-validator";

// We "hide" the require call under a different name. It prevents Webpack from
// choking the require use we make in this mode.

// tslint:disable-next-line: no-any
declare var platformRequire: any;
// tslint:disable-next-line:no-typeof-undefined
const req = typeof platformRequire !== "undefined" ? platformRequire : require;

const MMWPA_MODE_ORIGIN = "https://github.com/mangalam-research/mmwp";

class MMWPAMode extends generic.Mode<generic.GenericModeOptions> {
  private readonly numberWordsTr: Transformation;
  private readonly unnumberWordsTr: Transformation;
  private readonly splitCompoundIntoPartsTr: Transformation;

  readonly optionTemplate: objectCheck.Template = {
    autoinsert: false,
  };

  constructor(editor: EditorAPI, options: generic.GenericModeOptions) {
    super(editor, options);

    this.wedOptions.metadata = {
      name: "MMWP Annotation Mode",
      authors: ["Louis-Dominique Dubeau"],
      description: "This is a mode for use with MMWP.",
      license: "MPL 2.0",
      copyright: "Mangalam Research Center for Buddhist Languages",
    };

    this.wedOptions.label_levels.max = 2;
    this.wedOptions.attributes = {
      handling: "edit",
      autohide: {
        method: "selector",
        elements: [{
          selector: "word",
          attributes: ["*", {
            except: ["id"],
          }],
        }],
      },
    };

    this.numberWordsTr = new Transformation(
      MMWPA_MODE_ORIGIN, editor, "transform", "Number the words",
      mmwpaTr.numberWords);
    this.unnumberWordsTr = new Transformation(
      MMWPA_MODE_ORIGIN, editor, "transform", "Unnumber the words",
      mmwpaTr.unnumberWords);
    this.splitCompoundIntoPartsTr = new Transformation(
      MMWPA_MODE_ORIGIN, editor, "split", "Split compound into parts",
      mmwpaTr.splitCompoundIntoParts);
  }

  async init(): Promise<void> {
    await super.init();

    const wordClass =
      util.classFromOriginalName("word", this.metadata.getNamespaceMappings());
    const editor = this.editor;
    const dl = editor.domlistener;

    let sentences: Element[] = [];
    const wordAddedRemoved =
      ({ root, element }: { root: Node, element: Element }) => {
        // Skip elements which would already have been removed from the
        // tree. Unlikely but...
        if (!root.contains(element)) {
          return;
        }

        const dataEl = domutil.mustGetMirror(element);
        const sentence = dataEl.parentNode as Element;
        // We only act if the word was a direct child of a sentence.
        if ((sentence.tagName === "s") &&
            (sentences.indexOf(sentence) === -1)) {
          sentences.push(sentence);
        }
      };

    dl.addHandler("added-element", wordClass, wordAddedRemoved);
    dl.addHandler("removing-element", wordClass, wordAddedRemoved);

    editor.transformations.subscribe(ev => {
      if (ev.name !== "EndTransformation" || sentences.length === 0) {
        return;
      }

      try {
        for (const sentence of sentences) {
          mmwpaTr.renumberWords(editor, sentence);
        }
      }
      catch (ex) {
        if (!(ex instanceof AbortTransformationException)) {
          throw ex;
        }

        ev.abort(ex.message);
      }

      sentences = [];
    });

    // We check for the mark that ``mmwpaTr.renumberWords`` left among the undos
    // to bring up a warning for the user.
    editor.undoEvents.subscribe(ev => {
      if (ev.undo instanceof mmwpaTr.WordNumberingMarker) {
        mmwpaTr.getRenumberModal(editor).modal();
      }
    });
  }

  makeMetadata(): Promise<MMWPAMetadata> {
    return Promise.resolve(new MMWPAMetadata());
  }

  getContextualActions(transformationType: string | string[], tag: string,
                       container: Node, offset: number): Action<{}>[] {
    const el = (isText(container) ? container.parentNode :
                container) as Element;

    if (!(transformationType instanceof Array)) {
      // tslint:disable-next-line:no-parameter-reassignment
      transformationType = [transformationType];
    }

    const ret = super.getContextualActions(transformationType, tag, container,
                                           offset);
    if (transformationType.indexOf("wrap-content") !== -1 &&
        el.tagName === "s") {
      ret.push(this.numberWordsTr, this.unnumberWordsTr);
    }

    if (transformationType.indexOf("split") !== -1 &&
        el.tagName === "word") {
      ret.push(this.splitCompoundIntoPartsTr);
    }

    return ret;
  }

  getAttributeCompletions(attribute: Attr): string[] {
    // tslint:disable-next-line:no-non-null-assertion
    const el = attribute.ownerElement!;
    if ((el.tagName === "word") &&
        ["conc.head", "dep.head"].indexOf(attribute.name) !== -1) {
      const s = el.parentNode as Element;
      const ids = [];
      let child = s.firstElementChild;
      while (child !== null) {
        // We cannot refer to ourselves.
        if (child !== el) {
          const id = child.getAttribute("id");
          if (id !== null) {
            ids.push(id);
          }
        }
        child = child.nextElementSibling;
      }
      return ids;
    }

    return [];
  }

  getValidator(): ModeValidator {
    return new MMWPAValidator(this.editor.dataRoot);
  }

  getStylesheets(): string[] {
    let root = req.toUrl(".") as string;
    if (!root.endsWith("/")) {
      root += "/";
    }
    return [`${root}mmwpa-mode.css`];
  }
}

export { MMWPAMode as Mode };
