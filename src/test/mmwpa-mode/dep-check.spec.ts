import { expect } from "chai";

import { ValidationError } from "salve";

import { DepCheck } from "../../app/mmwpa-mode/dep-check";

// We use innerHTML a lot for testing purposes.
// tslint:disable:no-inner-html

describe("DepCheck", () => {
  let container: Element;
  let depCheck: DepCheck;
  beforeEach(() => {
    const parent = document.createElement("div");
    container = document.createElement("s");
    parent.appendChild(container);
    depCheck = new DepCheck("dep", container);
  });

  describe("#addNode", () => {
    it("throws if @id is not set", () => {
      const node = document.createElement("a");
      expect(() => depCheck.addNode(node)).to.throw(Error, "id missing");
    });

    it("reports an error if the id is duplicate", () => {
      const node = document.createElement("a");
      node.setAttribute("id", "1");
      depCheck.addNode(node);
      expect(depCheck.addNode(node))
        .to.deep.equal(new ValidationError("duplicate id 1"));
    });
  });

  describe("#check", () => {
    it("does not report any errors if there are no errors", () => {
      container.innerHTML = `\
<x id="1" dep.head="2"></x>
<x id="2" dep.head="3"></x>
<x id="3" dep.head="4"></x>
<x id="4"></x>
`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      expect(depCheck.check()).to.have.lengthOf(0);
    });

    it("reports if a node is referring a non-existent node", () => {
      container.innerHTML = `\
<x id="1" dep.head="99"></x>\
<x id="2" dep.head="88"></x>\
<x id="3" dep.head="4"></x>\
<x id="4"></x>`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      const expected = [{
        error: new ValidationError("word 1 depends on non-existent word 99"),
        node: container,
        index: 0,
      }, {
        error: new ValidationError("word 2 depends on non-existent word 88"),
        node: container,
        index: 1,
      }];
      expect(depCheck.check()).to.deep.equal(expected);
    });

    it("reports if a node is annotated but not part of the tree", () => {
      container.innerHTML = `\
<x id="1" dep.head="2"></x>\
<x id="2" dep.head="3"></x>\
<x id="3" dep.head="4"></x>\
<x id="4"></x>\
<x id="5" lem="q" dep.rel="something"></x>\
<x id="6" lem="q" dep.rel="something"></x>\
`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      const expected = [{
        error: new ValidationError(
          "word 5 has dep.rel but is not part of the dep tree"),
        node: container,
        index: 4,
      }, {
        error: new ValidationError(
          "word 6 has dep.rel but is not part of the dep tree"),
        node: container,
        index: 5,
      }];
      expect(depCheck.check()).to.deep.equal(expected);
    });

    it("reports if there is more than one root", () => {
      container.innerHTML = `\
<x id="1" dep.head="2"></x>\
<x id="2"></x>\
<x id="3" dep.head="4"></x>\
<x id="4"></x>`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      const expected = [{
        error: new ValidationError(
          "word 2 is a duplicated root in the dep tree"),
        node: container,
        index: 1,
      }, {
        error: new ValidationError(
          "word 4 is a duplicated root in the dep tree"),
        node: container,
        index: 3,
      }];
      expect(depCheck.check()).to.deep.equal(expected);
    });

    it("reports if there is no root", () => {
      container.innerHTML = `<x id="1" dep.head="1"></x>`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      const expected = [{
        error: new ValidationError("the dep tree has no root"),
        node: container.parentNode,
        index: 0,
      }];
      expect(depCheck.check()).to.deep.equal(expected);
    });

    it("reports unreachable dependencies", () => {
      container.innerHTML = `\
<x id="1" dep.head="2"></x>\
<x id="2" dep.head="3"></x>\
<x id="3" dep.head="1"></x>\
<x id="4" dep.head="5"></x>\
<x id="5"></x>`;
      for (const child of Array.prototype.slice.call(container.children)) {
        depCheck.addNode(child);
      }

      const expected = [{
        error: new ValidationError(`word 1 has a dependency in the \
dep tree but is unreachable from the root`),
        node: container,
        index: 0,
      }, {
        error: new ValidationError(`word 2 has a dependency in the \
dep tree but is unreachable from the root`),
        node: container,
        index: 1,
      }, {
        error: new ValidationError(`word 3 has a dependency in the \
dep tree but is unreachable from the root`),
        node: container,
        index: 2,
      }];
      expect(depCheck.check()).to.deep.equal(expected);
    });
  });
});
