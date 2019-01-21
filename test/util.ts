export function waitFor(fn: () => boolean | Promise<boolean>,
                        delay: number = 100,
                        timeout?: number):
Promise<boolean> {
  const start = Date.now();

  function check(): boolean | Promise<boolean> {
    const ret = fn();
    if (ret) {
      return ret;
    }

    if ((timeout !== undefined) && (Date.now() - start > timeout)) {
      return false;
    }

    return new Promise((resolve) => setTimeout(resolve, delay)).then(check);
  }

  return Promise.resolve().then(check);
}

export function waitForSuccess(fn: () => void,
                               delay?: number,
                               timeout?: number):
Promise<void> {
  return waitFor(() => {
    try {
      fn();
      return true;
    }
    catch (e) {
      if (e instanceof chai.AssertionError) {
        return false;
      }

      throw e;
    }
    // tslint:disable-next-line:align
  }, delay, timeout).then(() => undefined);
}

export class DataProvider {
  private readonly cache: Record<string, string> = Object.create(null);
  private readonly parser: DOMParser = new DOMParser();

  constructor(private readonly base: string) {}

  getText(path: string): Promise<string> {
    return this._getText(this.base + path);
  }

  async _getText(path: string): Promise<string> {
    const cached = this.cache[path];
    if (cached !== undefined) {
      return cached;
    }

    const data = await (await fetch(path)).text();
    this.cache[path] = data;
    return data;
  }

  async getDoc(path: string): Promise<Document> {
    const data = await this._getText(this.base + path);
    return this.parser.parseFromString(data, "text/xml");
  }
}
