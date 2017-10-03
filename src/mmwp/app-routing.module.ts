import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

// This must be copied from the app-routing module from wed-demo and modified so
// that the paths start with dashboard/. Otherwise, the relative paths screw up
// Angular. This must be statically analyzable, so no `forEach` to modify the
// routes from wed-demo.
export const routes: Routes = [
  { path: "", redirectTo: "/xml", pathMatch: "full" },
  { path: "xml",
    loadChildren: "dashboard/xml-files/xml-files.module#XMLFilesModule" },
  { path: "schemas",
    loadChildren: "dashboard/schemas/schemas.module#SchemasModule" },
  { path: "metadata",
    loadChildren: "dashboard/metadata/metadata.module#MetadataModule" },
  { path: "control",
    loadChildren: "dashboard/control/control.module#ControlModule" },
  { path: "packs", loadChildren: "dashboard/packs/packs.module#PacksModule" },
];

//tslint:disable-next-line:no-stateless-class
@NgModule({
  imports: [ RouterModule.forRoot(routes, {
    useHash: true,
  }) ],
  exports: [ RouterModule ],
})
export class AppRoutingModule {}
