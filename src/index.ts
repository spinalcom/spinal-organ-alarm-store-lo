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

import { SpinalGraphService, SpinalNode} from "spinal-env-viewer-graph-service";
import { spinalCore, FileSystem } from "spinal-core-connectorjs";
import cron = require('node-cron');
import * as config from "../config";
import { Utils } from "./utils"
import * as constants from "./constants"
import {PosInfoStore } from "./types";
import { get } from "http";
import { info } from "console";
const utils = new Utils();



class SpinalMain {
    connect: spinal.FileSystem;


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



    /** for debugging purposes
     * The main function of the class
     */
    /*public async MainJob() {


        const context = await SpinalGraphService.getContext(process.env.HarwareContext);
       
        if (context === undefined) {
            throw new Error(`Context with name ${process.env.HarwareContext} not found.`);
        }
        const floors = await context.getChildren("hasNetworkTreeGroup")

        if (floors.length === 0) {
            throw new Error(`No floors found in context ${process.env.HarwareContext}.`);
        }
        const positions : SpinalNode[] = []
        for (const floor of floors) {
            const floorPositions = await floor.getChildren("hasNetworkTreeBimObject");
            positions.push(...floorPositions);
        }
        console.log(`Found ${positions.length} positions in context ${process.env.HarwareContext}.`);

        const AllEndpoints : PosInfoStore[] = [];
        for (const position of positions) {
            const posData = await utils.getInfoPosition(position);
            for (const info of posData) {
                const check = await utils.checkEndpointValue(info.endpoint);
                console.log(`Check endpoint ${info.endpoint.info.name.get()} for position ${position.info.name.get()}: ${check}`);
                if (check) {
                    
                        info.CPelement.currentValue.set(true);
                        console.log(`Set command Control Point for position ${position.info.name.get()}`);
                        break;                                       
                }
            }
            AllEndpoints.push(...posData);
        }
        
        await utils.BindGTBendPoint(AllEndpoints);
        console.log ("Binding done");
    }*/

    public async asyncPool<T>(
        poolLimit: number,
        array: T[],
        iteratorFn: (item: T) => Promise<void>
    ){
        const ret: Promise<void>[] = [];
        const executing: Promise<void>[] = [];

        for (const item of array) {
            const p = Promise.resolve().then(() => iteratorFn(item));
            ret.push(p);

            if (poolLimit <= array.length) {
                const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                executing.push(e);
                if (executing.length >= poolLimit) {
                    await Promise.race(executing);
                }
            }
        }
        return Promise.all(ret);
    }

    public async MainJob() {

        const context = await SpinalGraphService.getContext(process.env.HarwareContext);
        if (!context) {
            throw new Error(`Context with name ${process.env.HarwareContext} not found.`);
        }

        const floors = await context.getChildren("hasNetworkTreeGroup")
        
        
        //const floors = (await context.getChildren("hasNetworkTreeGroup")).filter((node) => node.info.name.get() === "6");
        if (floors.length === 0) {
            throw new Error(`No floors found in context ${process.env.HarwareContext}.`);
        }
        const positionsArrays = await Promise.all(
            floors.map(floor =>
                floor.getChildren("hasNetworkTreeBimObject")
            )
        );
        const positions: SpinalNode[] = positionsArrays.flat();
        //const positions: SpinalNode[] = (positionsArrays.flat()).filter((node) =>node.info.name.get() === "FG_MBL_bureau 160x80 n°2 carré [18705238]" || node.info.name.get() === "FG_MBL_bureau 160x80 n°2 carré [18705237]" || node.info.name.get() === "FG_MBL_bureau 160x80 n°2 carré [18705236]");


        console.log(`Found ${positions.length} positions.`);

        const AllEndpoints: PosInfoStore[] = [];

        await this.asyncPool(15, positions, async (position) => {
            const posData = await utils.getInfoPosition(position);
            try {
                const CP = posData[0].CPelement;
                let doubleCheck = false;
                for (const info of posData) {
                    const check = await utils.checkEndpointValue(info.endpoint);
                    console.log(`Check endpoint ${info.endpoint.info.name.get()} for position ${position.info.name.get()}: ${check}`);

                    if (check) {
                        info.CPelement.currentValue.set(true);
                        console.log(`Set CP for ${position.info.name.get()} to true`);
                        doubleCheck = true;
                        break;
                    }
                }
                if (!doubleCheck){
                    CP.currentValue.set(false);
                    console.log(`Set command Control Point for position ${position.info.name.get()} to false`);
                }

                AllEndpoints.push(...posData);
            } catch (error) {
                console.error("Error processing position ", position.info.name.get(), error);
            }


        });

        await utils.BindGTBendPoint(AllEndpoints);
        console.log("Binding done");
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


Main()