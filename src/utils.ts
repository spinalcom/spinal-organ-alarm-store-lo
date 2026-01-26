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
import { NetworkService, InputDataEndpoint, InputDataEndpointDataType, InputDataEndpointType, SpinalBmsEndpoint } from "spinal-model-bmsnetwork"
import { SpinalAttribute } from "spinal-models-documentation/declarations";
import { attributeService, ICategory } from "spinal-env-viewer-plugin-documentation-service";
import { PosInfo, PosInfoStore, PositionData, PositionsDataStore, PositionTempData } from "./types";
import { ProcessBind } from "./processBind";
export const networkService = new NetworkService()



/**
 * @export
 * @class Utils
 */
export class Utils {
    processBind: ProcessBind = new ProcessBind();
    ATTRIBUTE_NAME = "controlValue";
    INIT_ZONE_MODE = "initZoneMode";
    ATTRIBUTE_CATEGORY_NAME = "default";
    DEFAULT_COMMAND_VALUE = "null";
    store_filter = "SRG_ELE_Moteur store";
    controlPointName = constants.BlindControlPointT;


    
     
    /*public async getBlinds(contextName): Promise<PosInfoStore[]> {

        const context = await SpinalGraphService.getContext(contextName);
        if (context === undefined) {
            throw new Error(`Context with name ${contextName} not found.`);
        }
        const floors = await context.getChildren("hasNetworkTreeGroup");
        if (floors.length === 0) {
            throw new Error(`No floors found in context ${contextName}.`);
        }
        const blinds: PosInfoStore[] = [];
        for(const floor of floors) {
            const positions = await floor.getChildren("hasNetworkTreeBimObject");
            for(const position of positions) {

                const positionBlinds = await this.getStoreForPosition(position.id.get());
                blinds.push(...positionBlinds);
            }
        }
        return blinds;
    }*/
   

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
                        // Check if the BMS endpoint matches the criteria
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


    // function to get stores linked to position 
    public async getEndpointPosition(workposition: SpinalNode<any>): Promise<SpinalNode<any>[]> {

        const result :SpinalNode<any>[] = [];
        const bimObjects = await workposition.getChildren("hasNetworkTreeBimObject");
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

 
  

    /**
        * Function that search for the targeted attribute of a node and update it's value 
        * @param  {SpinalNode} endpointNode
        * @param  {any} valueToPush
        * @returns Promise
        */
    public async updateControlValueAttribute(endpointNode: SpinalNode<any>, attributeCategoryName: string | ICategory, attributeName: string, valueToPush: any): Promise<SpinalAttribute | undefined> {
        const attribute = await this._getEndpointControlValue(endpointNode, attributeCategoryName, attributeName)
        if (attribute) {
            attribute.value.set(valueToPush);
            console.log(attributeName+ " ==>  is updated with the value : " + attribute.value);
            return attribute;
        }
        else {
            console.log(valueToPush + " value to push in node : " + endpointNode.info.name.get() + " -- ABORTED !");
        }
    }



    /**
        * Function that search and return the targeted attribute. Creates it if it doesn't exist with a default value of null
        * @param  {SpinalNode} endpointNode
        * @returns Promise
        */
    public async _getEndpointControlValue(endpointNode: SpinalNode<any>, attributeCategoryName: string | ICategory, attributeName: string): Promise<SpinalAttribute> {
        const attribute = await attributeService.findOneAttributeInCategory(endpointNode, attributeCategoryName, attributeName)
        if (attribute != -1) return attribute;

        return attributeService.addAttributeByCategoryName(endpointNode, this.ATTRIBUTE_CATEGORY_NAME, attributeName, this.DEFAULT_COMMAND_VALUE);
    }

  
   
    

    public async updateEndpointValue(endpoint: SpinalNodeRef, valueToPush: string) {
        const endpointNode = SpinalGraphService.getRealNode(endpoint.id.get());
        //update controlValue attribute for the endpoint sig_Hauteur
        await this.updateControlValueAttribute(endpointNode, this.ATTRIBUTE_CATEGORY_NAME, this.ATTRIBUTE_NAME, valueToPush);
        endpointNode.info.directModificationDate.set(Date.now());
    }

    public async gtbReadValue(endpointValue: string): Promise<number[]> {
        if (endpointValue.length < 8) {
            throw new Error("La trame doit contenir au moins 4 octets (8 caractères hex).");
        }

        // Récupérer les 2 derniers octets
        const indicatorsHex = endpointValue.slice(-4);
        console.log("Indicateurs hex :", indicatorsHex);

        // Convertir en nombre puis en binaire sur 16 bits
        const indicatorsBin = parseInt(indicatorsHex, 16)
            .toString(2)
            .padStart(16);
        console.log("Indicateurs bin :", indicatorsBin);

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




   public async BindGTBendPoint(position : SpinalNode<any>, endpointList : SpinalNode<any>[]) {
        for (const endp of endpointList) {
            
            
         
            if (endp != undefined ) {
        
                let endPmodifDate = endp.info.directModificationDate;
                
                this.processBind.addBind(endPmodifDate, async () => {
                    console.log(endPmodifDate.get())
                    console.log("EndPoint modified:", endp.info.name.get());
                    // read the endpoint value
                    const GTBelement = await endp.element.load();
                    const GTBvalue = GTBelement.currentValue.get();
                    console.log("New endpoint value:", GTBvalue);
                    const bitArray = await this.gtbReadValue(GTBvalue);
                    // If one of the bits 6, 7, or 8 is set to 1, update the control point
                    if (bitArray.reduce((a, b) => a + b, 0) > 0) {
                        // call update control point
                        await this.setCommandControlPoint(position);
                    }
                });
               
            }
        }
        setTimeout(() => {
            this.processBind.started = true;
        console.log("ProcessBind started")
        }, 10000);
    }

}