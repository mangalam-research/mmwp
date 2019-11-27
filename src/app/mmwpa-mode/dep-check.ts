import { ValidationError } from "salve";
import { ErrorData } from "salve-dom";

function indexOf(something: {}, item: {}): number {
  return Array.prototype.indexOf.call(something, item);
}

function depNameToRelAttributeName(depName: string): string {
  return `${depName}.rel`;
}

class DepNode {
  public readonly annotated: boolean = false;
  public readonly dependents: DepNode[] = [];
  public readonly dep?: string;

  constructor(public readonly treeName: string,
              public readonly element: Element,
              public readonly id: string,
              dep?: string | null) {
    const depAttr = element.getAttribute(depNameToRelAttributeName(treeName));
    this.annotated = depAttr !== null;

    // Dep may be null if the element does not have the necessary attribute. Or
    // it could be empty if it is not input yet or being edited. We don't raise
    // a fuss about this because the schema is what is responsible for
    // complaining if it is not complete.
    this.dep = (dep === null || dep === "") ? undefined : dep;
  }

  get parent(): Node {
    const node = this.element.parentNode;
    if (node === null) {
      throw new Error("detached element");
    }
    return node;
  }

  get offset(): number {
    return indexOf(this.parent.childNodes, this.element);
  }

  makeError(message: string): ErrorData {
    return {
      error: new ValidationError(message),
      node: this.parent,
      index: this.offset,
    };
  }

  addDependent(dep: DepNode): void {
    this.dependents.push(dep);
  }
}

type IdToNode = Record<string, DepNode>;

export class DepCheck {
  private idToNode: IdToNode = Object.create(null);
  private readonly pointerAttributeName: string;
  constructor(private readonly treeName: string,
              private readonly container: Element) {
    this.pointerAttributeName = `${treeName}.head`;
  }

  addNode(element: Element): ValidationError | undefined {
    const id = element.getAttribute("id");
    if (id === null) {
      throw new Error("id missing");
    }

    if (this.idToNode[id] !== undefined) {
      return new ValidationError(`duplicate id ${id}`);
    }

    const dep = element.getAttribute(this.pointerAttributeName);
    this.idToNode[id] = new DepNode(this.treeName, element, id, dep);

    return undefined;
  }

  check(): ErrorData[] {
    const ret = [];

    const participating: IdToNode = Object.create(null);

    // Check that all dep point to nodes that exist and extract the set of nodes
    // that are actually participating in dependencies.
    const ids = Object.keys(this.idToNode);
    const allNodes = [];
    let exists = false;
    for (const id of ids) {
      const node = this.idToNode[id];
      allNodes.push(node);
      const depId = node.dep;
      if (depId !== undefined) {
        exists = true;
        participating[id] = node;
        const dependent = this.idToNode[depId];
        if (dependent === undefined) {
          ret.push(node.makeError(
            `word ${id} depends on non-existent word ${depId}`));
        }
        participating[depId] = dependent;
      }
    }

    for (const node of allNodes) {
      if (node.annotated && !(node.id in participating)) {
        ret.push(node.makeError(
          `word ${node.id} has ${depNameToRelAttributeName(this.treeName)} \
but is not part of the ${this.treeName} tree`));
      }
    }

    if ((// Nothing is part of the tree.
          !exists ||
            // The errors we got prevent us from moving on.
            ret.length !== 0)) {
      return ret;
    }

    // Find the roots and add reverse relations (we add the dependents to the
    // nodes they depend on).
    const roots = [];
    for (const id of Object.keys(participating)) {
      const node = participating[id];
      const dep = node.dep;
      if (dep === undefined) {
        roots.push(node);
      }
      else {
        participating[dep].addDependent(node);
      }
    }

    if (roots.length > 1) {
      for (const root of roots) {
        ret.push(root.makeError(
          `word ${root.id} is a duplicated root in the ${this.treeName} tree`));
      }

      return ret;
    }
    else if (roots.length === 0) {
      ret.push(this.makeError(`the ${this.treeName} tree has no root`));

      return ret;
    }

    this.walk(roots[0], participating, ret);

    return ret;
  }

  private walk(root: DepNode, participating: IdToNode,
               errors: ErrorData[]): void {
    const seen: Record<string, boolean> = Object.create(null);
    this._walk(root, seen, [], errors);
    const notSeen = Object.keys(participating).filter(key => !(key in seen));
    for (const id of notSeen) {
      const node = participating[id];
      errors.push(node.makeError(`word ${id} has a dependency in the \
${this.treeName} tree but is unreachable from the root`));
    }
  }

  private _walk(current: DepNode, memo: Record<string, boolean>, path: string[],
                errors: ErrorData[]): void {
    const id = current.id;
    if (path.indexOf(id) !== -1) {
      // It is currently not possible to trigger this error. A tree with a
      // circular dependency will either have the wrong number of roots or will
      // have a cycle which is unreachable from the root.
      errors.push(
        current.makeError(`${this.treeName} tree has a circular dependency \
${path.join(", ")}`));
      return;
    }

    if (id in memo) {
      // It is also not currenty possible to trigger this error, due to the fact
      // that one word can only depend on another one. It is not possible to
      // create a diamond, for instance.
      errors.push(
        current.makeError(
          `seen ${id} already: tree ${this.treeName} is not a tree`));
      return;
    }

    memo[id] = true;

    const newPath = path.concat(id);
    for (const dependent of current.dependents) {
      this._walk(dependent, memo, newPath, errors);
    }
  }

  get parent(): Node {
    const node = this.container.parentNode;
    if (node === null) {
      throw new Error("detached node");
    }

    return node;
  }

  get offset(): number {
    return indexOf(this.parent.childNodes, this.container);
  }

  makeError(message: string): ErrorData {
    return {
      error: new ValidationError(message),
      node: this.parent,
      index: this.offset,
    };
  }
}
