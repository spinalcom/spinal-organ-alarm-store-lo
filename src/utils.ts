/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalNode } from "spinal-model-graph"
import * as constants from "./constants"
import {InfoStore} from "./types";
import { ProcessBind } from "./processBind";



/**
 * @export
 * @class Utils
 */
export class Utils {
    processBind: ProcessBind = new ProcessBind();
    store_filter = "SRG_ELE_Moteur store";
    controlPointName = constants.BlindControlPointT;



    public async setCommandControlPoint(workposition: SpinalNode<any>) {
        const NODE_TO_CONTROL_POINTS_RELATION = "hasControlPoints";
        const CONTROL_POINTS_TO_BMS_ENDPOINT_RELATION = "hasBmsEndpoint";

        // Fetch all control points associated with the work position
        const allControlPoints = await workposition.getChildren(NODE_TO_CONTROL_POINTS_RELATION);

        if (allControlPoints.length > 0) {
            for (const controlPoint of allControlPoints) {
                // Fetch all BMS endpoints associated with the control point
                const allBmsEndpoints = await controlPoint.getChildren(CONTROL_POINTS_TO_BMS_ENDPOINT_RELATION);

                if (allBmsEndpoints.length > 0) {
                    for (const bmsEndPoint of allBmsEndpoints) {
                        if (bmsEndPoint.info.name.get() === this.controlPointName) {
                            const nodeElement = await bmsEndPoint.element.load();
                            if (!nodeElement) continue;
                                nodeElement.currentValue.set(true);
                            
                        }
                    }
                }
            }
        }

      
    }
    public async getCommandControlPoint(
        workposition: SpinalNode<any>
    ): Promise<any | undefined> {

        const NODE_TO_CONTROL_POINTS_RELATION = "hasControlPoints";
        const CONTROL_POINTS_TO_BMS_ENDPOINT_RELATION = "hasBmsEndpoint";

        const controlPoints = await workposition.getChildren(
            NODE_TO_CONTROL_POINTS_RELATION
        );
        for (const controlPoint of controlPoints) {
            const bmsEndpoints = await controlPoint.getChildren(
                CONTROL_POINTS_TO_BMS_ENDPOINT_RELATION
            );
            for (const bmsEndPoint of bmsEndpoints) {
                if (bmsEndPoint.info.name.get() === this.controlPointName) {
                    const nodeElement = await bmsEndPoint.element.load();
                    if (nodeElement) {
                        return nodeElement;
                    }
                }
            }
        }

        return undefined;
    }



    // function to get stores linked to position 
    public async getInfo(ParentNode: SpinalNode<any>,ParentToChildRelation: string): Promise<InfoStore[] | []> {

        const result: InfoStore[] = [];
        const element = await this.getCommandControlPoint(ParentNode);
        if (element !== undefined) {
            const bimObjects = await ParentNode.getChildren(ParentToChildRelation);
            const stores = bimObjects.filter(x => x.info.name.get().includes(this.store_filter));

            if (stores.length !== 0) {
                for (const store of stores) {

                    const canal = await store.getChildren("hasBmsEndpoint");
                    if (canal.length !== 0) {
                        const bmsendpoint = (await canal[0].getChildren("hasBmsEndpoint"))
                            .find(child => child.info.name.get() === constants.GTBendpoint);

                        if (bmsendpoint !== undefined) {
                            //check curentValue later
                            result.push({
                                Parent: ParentNode,
                                endpoint: bmsendpoint,
                                CPelement: element
                            });
                        }
                    }
                }
            }

        }
        return result;
    }

      public async getEndPoints(ParentNode: SpinalNode<any>, ParentToChildRelation: string): Promise<SpinalNode[]> {

        const result: SpinalNode[] = [];        
            const bimObjects = await ParentNode.getChildren(ParentToChildRelation);
            const stores = bimObjects.filter(x => x.info.name.get().includes(this.store_filter));

            if (stores.length !== 0) {
                for (const store of stores) {
                    const canal = await store.getChildren("hasBmsEndpoint");
                    if (canal.length !== 0) {
                        const bmsendpoint = (await canal[0].getChildren("hasBmsEndpoint"))
                            .find(child => child.info.name.get() === constants.GTBendpoint);

                        if (bmsendpoint !== undefined) {
                            //check curentValue later
                            result.push(bmsendpoint);
                        }
                    }
                }
            }
        
        return result;
    }

    public async gtbReadValue(ParentNode : SpinalNode<any>, endpointValue: string): Promise<number[]> {
        if (endpointValue.length < 8) {
            throw new Error("position " + ParentNode.info.name.get() + ", La trame doit contenir au moins 4 octets (8 caractères hex).");
        }

        // Récupérer les 2 derniers octets
        const indicatorsHex = endpointValue.slice(-4);
        //console.log("Indicateurs hex :", indicatorsHex);

        // Convertir en nombre puis en binaire sur 16 bits
        const indicatorsBin = parseInt(indicatorsHex, 16)
            .toString(2)
            .padStart(16);
        //console.log("Indicateurs bin :", indicatorsBin);

        // Transformer la string binaire en tableau de bits
        // bitArray[0] = LSB, bitArray[15] = MSB
        const bitArray = indicatorsBin
            .split("")
            .reverse()   // inversion pour que bitArray[0] = LSB
            .map(b => Number(b));

        // Extraire les bits 6, 7, 8
        const bit6 = bitArray[6];
        const bit7 = bitArray[7];
        const bit8 = bitArray[8];

        return [bit6, bit7, bit8];
    }


    public async checkAllPosInfo(endpList: InfoStore[]): Promise<boolean> {
        let result = false;
        for (const endpInfo of endpList) {
            const { Parent: ParentNode, endpoint: endp } = endpInfo;
            const check = await this.checkEndpointValue(ParentNode,endp);
            if(check){
                result = true;
                break;
            }
        }
        return result;  

    }
        public async checkAllEndpoints(ParentNode: SpinalNode<any>, endpList: SpinalNode<any>[]): Promise<boolean> {
        let result = false;
        for (const endp of endpList) {
            const check = await this.checkEndpointValue(ParentNode, endp);
            if(check){
                result = true;
                break;
            }
        }
        return result;  

    }

    public async BindGTBendPoint(endpList: InfoStore[]) {
        for (const endpInfo of endpList) {
            console.log("Binding endpoint for :", endpInfo.Parent.info.name.get());
            const { Parent: ParentNode, endpoint: endp , CPelement: element} = endpInfo;
     
            let endpElement = await endp.element.load();
            let Value = endpElement.currentValue;
            this.processBind.addBind(Value, async () => {
                console.log("EndPoint modified:", endp.info.name.get() , " at :", ParentNode.info.name.get());
                // read the endpoint value
                const check = await this.checkEndpointValue(ParentNode, endp);
                if (check) {
                        element.currentValue.set(true);
                        console.log(`Set command Control Point for  ${ParentNode.info.name.get()} to true`);
                    
                }else {
                    const AllEndpoints = await this.getEndPoints(ParentNode, "hasNetworkTreeBimObject");
                    let doubleCheck = await this.checkAllEndpoints(ParentNode,AllEndpoints);
                    if(!doubleCheck){
                                       
                          element.currentValue.set(false);
                            console.log(`Set command Control Point for ${ParentNode.info.name.get()} to false`);
                        }


                }
                   
                

            });

            /*setTimeout(() => {
                this.processBind.started = true;
            console.log("ProcessBind started")
            }, 3000);*/
        }
    }

    async checkEndpointValue(ParentNode: SpinalNode<any>, endpoint: SpinalNode<any>,): Promise<boolean> {
        const GTBelement = await endpoint.element.load();
        const GTBvalue = GTBelement.currentValue?.get();
        if (GTBvalue) {
            try {
                const bitArray = await this.gtbReadValue(ParentNode,GTBvalue);
                // If one of the bits 6, 7, or 8 is set to 1, update the control point
                if (bitArray.reduce((a, b) => a + b, 0) > 0) {
                    // call update control point
                    return true;
                }

            } catch (error) {
                console.error("Error reading GTB value for position", ParentNode.info.name.get(), ":", error);

            }

        }
        return false;
    }
}