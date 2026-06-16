import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Component from "../Component";

/**
 * @namespace id.apnv.apex.ui.adminui.controller
 */
export default class App extends Controller {

    public onInit(): void {
        const menuModel = new JSONModel(sap.ui.require.toUrl('id/apnv/apex/ui/adminui/model/menu.json'))
        this.getView()?.setModel(menuModel, 'sideMenu')

        const owner = this?.getOwnerComponent() as Component
        owner.getRouter().attachRouteMatched((oEvent: any) => {
            const routeName = oEvent.getParameter('name');
            if (routeName === 'RoutePage') {
            }
        })

    }

    onItemPress(oEvent: any) {
        const item = oEvent.getParameter('item');
        const key = item.getKey();

        const owner = this?.getOwnerComponent() as Component
        owner.getRouter()?.navTo(key)
    }

}