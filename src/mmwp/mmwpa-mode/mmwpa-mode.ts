import { Action } from "wed/action";
import { isText } from "wed/domtypeguards";
import * as generic from "wed/modes/generic/generic";
import * as objectCheck from "wed/object-check";
import { Transformation, TransformationData } from "wed/transformation";
import { ModeValidator } from "wed/validator";
import { Editor } from "wed/wed";
import { MMWPAMetadata } from "./mmwpa-metadata";
import * as mmwpaTr from "./mmwpa-tr";
import { MMWPAValidator } from "./mmwpa-validator";

class MMWPAMode extends generic.Mode<generic.GenericModeOptions> {
  private readonly numberSentencesTr: Transformation<TransformationData>;
  private readonly numberWordsTr: Transformation<TransformationData>;
  private readonly numberSentencesAndWordsTr:
  Transformation<TransformationData>;
  private readonly unnumberWordsTr: Transformation<TransformationData>;

  readonly optionTemplate: objectCheck.Template = {
    autoinsert: false,
  };

  constructor(editor: Editor, options: generic.GenericModeOptions) {
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

    this.numberSentencesTr = new Transformation(
      editor, "transform", "Number the sentences", mmwpaTr.numberSentences);
    this.numberWordsTr = new Transformation(
      editor, "transform", "Number the words", mmwpaTr.numberWords);
    this.numberSentencesAndWordsTr = new Transformation(
      editor, "transform", "Number sentences and words",
      mmwpaTr.numberSentencesAndWords);
    this.unnumberWordsTr = new Transformation(
      editor, "transform", "Unnumber the words", mmwpaTr.unnumberWords);
  }

  makeMetadata(): Promise<MMWPAMetadata> {
    return Promise.resolve(new MMWPAMetadata());
  }

  getContextualActions(transformationType: string | string[], tag: string,
                       container: Node, offset: number): Action<{}>[] {
    const el = (isText(container) ? container.parentNode :
                container) as Element;

    if (!(transformationType instanceof Array)) {
      transformationType = [transformationType];
    }

    const ret = super.getContextualActions(transformationType, tag, container,
                                           offset);
    if (transformationType.indexOf("wrap-content") !== -1 &&
        el.tagName === "cit") {
      ret.push(this.numberSentencesAndWordsTr, this.numberSentencesTr);
    }

    if (transformationType.indexOf("wrap-content") !== -1 &&
        el.tagName === "s") {
      ret.push(this.numberWordsTr, this.unnumberWordsTr);
    }

    return ret;
  }

  getAttributeCompletions(attribute: Attr): string[] {
    const el = attribute.ownerElement;
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

}

export { MMWPAMode as Mode };
