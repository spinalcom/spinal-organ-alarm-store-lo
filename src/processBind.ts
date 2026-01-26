import { Model, Process } from "spinal-core-connectorjs";


export class ProcessBind extends Process {
    mapCB: { model: Model, callback: Function }[] = [];
    constructor() {
        super([]);
    }

    addBind(model, callback) {
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
        console.log("ProcessBind onchange called");
        for (const item of this.mapCB) {
            const { model, callback } = item;
            if (model.has_been_directly_modified()) {
                callback();
            }
        }
        
    }


    destructor() {
        super.destructor();
    }
}