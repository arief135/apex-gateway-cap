import Controller from "sap/ui/core/mvc/Controller";
import Component from "../Component";
import ScrollContainer from "sap/m/ScrollContainer";
import XMLView from "sap/ui/core/mvc/XMLView";

/**
 * @namespace id.apnv.apex.ui.adminui.controller
 */
export default class Main extends Controller {


    public onInit(): void {
    }

    loadPage(pageKey: string) {

        const rootContainer = this.getView()?.byId('rootContainer') as ScrollContainer;
        rootContainer.removeAllContent();

        XMLView.create({
            viewName: `id.apnv.apex.ui.adminui.view.${pageKey}`
        }).then((page) => {
            rootContainer.addContent(page);
        });
    }

    onItemPress(oEvent: any) {
        const item = oEvent.getParameter('item');
        const key = item.getKey();

        const owner = this?.getOwnerComponent() as Component
        owner.getRouter()?.navTo('RoutePage', { routeKey: key });
    }
}