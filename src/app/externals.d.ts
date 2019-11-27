declare module "slugify" {
  // tslint:disable-next-line: class-name
  interface slugify {
    extend(mapping: {[name: string]: string}): void;
  }
  function slugify(str: string, replacement?: string): string;
  export = slugify;
}
