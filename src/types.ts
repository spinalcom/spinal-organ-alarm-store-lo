import { SpinalNodeRef,SpinalNode } from "spinal-env-viewer-graph-service";


export type PosInfo = {
    bmsgroup: SpinalNodeRef;
    Netgroup: SpinalNodeRef;
    endpoint: SpinalNodeRef;
};

export type PositionData = {
    position: SpinalNodeRef;
    CP: SpinalNodeRef | undefined;
    PosINFO: PosInfo[];
};

export type PositionsDataStore={
    position: SpinalNodeRef;
    CP: SpinalNodeRef | undefined;
    storeINFO: PosInfoStore[];
}
export type PosInfoStore={
    Position: SpinalNode<any>;
    endpoint: SpinalNode<any>;
}
export type PositionTempData={
    position: SpinalNodeRef;
    CP : SpinalNodeRef | undefined;
    TempEndpoint: SpinalNodeRef;
}
