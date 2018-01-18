import { CSVDocumentRenderer } from "./csv";

export class AnnotatedDocumentCSVRenderer extends CSVDocumentRenderer {
  renderColumnName(name: string): string {
    // We perform a check here too, additionally to any checks the document
    // itself performs on its column names. Better be doubly safe.
    if (!/^[a-zA-Z0-9.]+$/.test(name) ||
        // A sequence of dots will throw off the transformation, and
        // does not make much sense.
        /\.\./.test(name) ||
        // A name that starts or ends with a dot does not seem right.
        name[0] === "." || name[name.length - 1] === ".") {
      throw new Error(`cannot support column name: ${name}`);
    }

    // cameCase the name, and drop the periods.
    return super.renderColumnName(
      name.replace(/\../g, (match) => match[1].toUpperCase())
        .replace(/\.$/, ""));
  }
}
