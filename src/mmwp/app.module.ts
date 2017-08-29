import { NgModule } from "@angular/core";

import { configuration } from "dashboard/app.module";
import { XMLTransformService } from "dashboard/xml-transform.service";

import { ConcordanceTransformService } from "./concordance-transform.service";
import { CoNLLTransformService } from "./conll-transform.service";

// tslint:disable-next-line:no-non-null-assertion
configuration.providers!.push({
  provide: XMLTransformService,
  useClass: ConcordanceTransformService,
  multi: true,
}, {
  provide: XMLTransformService,
  useClass: CoNLLTransformService,
  multi: true,
}, {
  provide: "Mode",
  useValue: {
    name: "mmwpa-mode",
    path: "mmwp/mmwpa-mode/mmwpa-mode",
  },
  multi: true,
});

// tslint:disable-next-line:no-stateless-class
@NgModule(configuration)
export class AppModule { }
