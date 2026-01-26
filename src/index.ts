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

import { SpinalGraphService, SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { spinalCore, FileSystem } from "spinal-core-connectorjs_type";
import cron = require('node-cron');
import * as config from "../config";
import { Utils } from "./utils"
import * as constants from "./constants"
import { PositionData, PosInfoStore } from "./types";
const utils = new Utils();



class SpinalMain {
    connect: spinal.FileSystem;

    private CP_to_PositionsToData = new Map<string, PositionData>();

    constructor() {
        const url = `${config.hubProtocol}://${config.userId}:${config.userPassword}@${config.hubHost}:${config.hubPort}/`;
        this.connect = spinalCore.connect(url)
    }

    /**
     * 
     * Initialize connection with the hub and load graph
     * @return {*}
     * @memberof SpinalMain
     */
    public init() {
        return new Promise((resolve, reject) => {


            spinalCore.load(this.connect, config.digitalTwinPath, async (graph: any) => {
                await SpinalGraphService.setGraph(graph);
                console.log("Connected to the hub");
                resolve(graph);
            }, () => {
                reject()
            })
        });
    }



    /**
     * The main function of the class
     */
    public async MainJob() {


        const context = await SpinalGraphService.getContext(process.env.HarwareContext);
       
        if (context === undefined) {
            throw new Error(`Context with name ${process.env.HarwareContext} not found.`);
        }
        const floors = (await context.getChildren("hasNetworkTreeGroup")).filter((e) => e.info.name.get() === "1");

        if (floors.length === 0) {
            throw new Error(`No floors found in context ${process.env.HarwareContext}.`);
        }
        for (const floor of floors) {
            const positions = (await floor.getChildren("hasNetworkTreeBimObject")).filter((e) => e.info.name.get() === "FG_MBL_bureau 160x80 n°2 carré [18706725]");
            if (positions.length === 0) {
                continue;
            }
            for (const position of positions) {

                //const blinds: PosInfoStore[] = [];

                const positionBlinds = await utils.getStoreForPosition(position);
                for (const blind of positionBlinds) {

                    const GTBelement = await blind.endpoint.element.load();
                    if (!GTBelement) continue;
                    const GTBvalue = GTBelement.currentValue.get();
                    if (!GTBvalue) continue;
                    console.log(GTBvalue)
                    const bitArray = await utils.gtbReadValue(GTBvalue)
                    
                    //if (bitArray.reduce((a, b) => a + b, 0) > 0) {
                        //call update control point
                         await utils.setCommandControlPoint(position);
                        
                    //}
                    
                }
            }
            //const blinds = await utils.getBlinds(process.env.HarwareContext);
            //console.log(`Found ${blinds.length} blinds in context ${process.env.HarwareContext}.`);

        }

    }
}
async function Main() {
    try {
        console.log('Organ Start');
        const spinalMain = new SpinalMain();
        await spinalMain.init();
        await spinalMain.MainJob();
        //process.exit(0);
    }
    catch (error) {
        console.error(error);
        setTimeout(() => {
            console.log('STOP ERROR');
            process.exit(0);
        }, 5000);
    }
}


// Call main function
Main()