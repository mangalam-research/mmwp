function checkColumnNames(columnNames: ReadonlyArray<string>): Set<string> {
  const ret = new Set();
  for (const name of columnNames) {
    // Empty names don't make sense.
    if (name === "") {
      throw new Error(`cannot support column name: ${name}`);
    }

    if (ret.has(name)) {
      throw new Error(`duplicate name: ${name}`);
    }

    ret.add(name);
  }

  return ret;
}

export class CSVRow {
  readonly columns: Record<string, string> = Object.create(null);

  constructor(readonly doc: CSVDocument) {}

  setColumn(name: string, value: string): void {
    if (!this.doc.columnNameSet.has(name)) {
      throw new Error(`unknown column name: ${name}`);
    }

    this.columns[name] = value;
  }
}

export class CSVDocument {
  readonly columnNameSet: ReadonlySet<string>;
  readonly rows: CSVRow[] = [];

  constructor(readonly columnNames: ReadonlyArray<string>) {
    this.columnNameSet = checkColumnNames(columnNames);
  }

  makeRow(): CSVRow {
    const row = new CSVRow(this);
    this.rows.push(row);
    return row;
  }
}

export interface RenderOptions {
  placeholder: string;
}

export class CSVDocumentRenderer {
  protected readonly finalPlaceholder: string;

  constructor(protected readonly options: Readonly<RenderOptions>) {
    this.finalPlaceholder = this.renderColumn(options.placeholder);
  }

  render(doc: CSVDocument): string {
    let text = "";

    text += this.renderHeading(doc);

    for (const row of doc.rows) {
      text += this.renderRow(doc, row);
    }

    return text;
  }

  renderHeading(doc: CSVDocument): string {
    let text = "";

    const columnNames = doc.columnNames;
    for (const name of columnNames) {
      text += this.renderColumnName(name);

      // This works to put separators between columns. We don't allow duplicate
      // column names.
      if (name !== columnNames[columnNames.length - 1]) {
        text += ",";
      }
    }

    return `${text}\n`;
  }

  renderColumnName(name: string): string {
    // We call render column as a safety net. There's no plan to put column
    // names with quotes in it or spaces, etc. but maybe we'll relax the rules
    // some day. If so, then we're ready.
    return this.renderColumn(name);
  }

  renderRow(doc: CSVDocument, row: CSVRow): string {
    let text = "";

    const columnNames = doc.columnNames;
    for (const name of columnNames) {
      text += this.renderColumn(row.columns[name]);

      // This works to put separators between columns. We don't allow duplicate
      // column names.
      if (name !== columnNames[columnNames.length - 1]) {
        text += ",";
      }
    }

    return `${text}\n`;
  }

  renderColumn(value?: string): string {
    let text = value === undefined ? this.finalPlaceholder : value;
    text = text
      // Normalize spaces.
      .replace(/\s+/g, " ")
      // Single quotes must be doubled.
      .replace(/"/g, "\"\"");

    // If there are commas or quotes in the text, then ...
    if (/[,"]/.test(text)) {
      // ... we must wrap the text in double quotes to properly encode it.
      text = `"${text}"`;
    }

    return text.trim();
  }
}
