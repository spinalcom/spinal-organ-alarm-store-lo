import { Model, Process } from "spinal-core-connectorjs";


export class ProcessBind extends Process {
    mapCB: { model: Model, callback: Function }[] = [];
    started: boolean = false;
    constructor() {
        super([],false);
    }

    addBind(model: Model, callback: Function) {
        
        model.bind(this, false);
        this.mapCB.push({ model, callback });

    }
    unbind(model) {
        for (const item of this.mapCB) {
            if (model === item.model) {
                model.unbind(this);
                const index = this.mapCB.indexOf(item);
                if (index > -1) {
                    this.mapCB.splice(index, 1);
                }
                break;
            }
        }

    }

    onchange(): void {
        //if (!this.started) return
        console.log("ProcessBind onchange called");
        // for (const item of this.mapCB) {
        //     console.log("Model state: ", item.model._server_id);
        // }
        // console.log(" ------- ");
        for (const item of this.mapCB) {
            //console.log("in onchange loop");
            const { model, callback } = item;
            if (model.has_been_directly_modified()) {
                console.log("Model directly modified, calling callback");
                callback();
            }
        }
        
    }


    destructor() {
        super.destructor();
    }
}