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
import { spinalCore} from "spinal-core-connectorjs";
import cron = require('node-cron');
import * as config from "../config";
import { Utils } from "./utils"
import * as constants from "./constants"
import {InfoStore } from "./types";
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

    private async OpenSpace_alarm(): Promise<void> {
        const context = await SpinalGraphService.getContext(process.env.HarwareContext);
        if (!context) {
            throw new Error(`Context with name ${process.env.HarwareContext} not found.`);
        }

        const floors = await context.getChildren("hasNetworkTreeGroup");
        
        if (floors.length === 0) {
            throw new Error(`No floors found in context ${process.env.HarwareContext}.`);
        }
        
        const positionsArrays = await Promise.all(
            floors.map(floor =>
                floor.getChildren("hasNetworkTreeBimObject")
            )
        );
        const positions: SpinalNode[] = positionsArrays.flat();

        console.log(`Found ${positions.length} positions.`);

        const AllEndpoints: InfoStore[] = [];

        await this.asyncPool(15, positions, async (position) => {
            const posData = await utils.getInfo(position, "hasNetworkTreeBimObject");
            try {
                const CP = posData[0].CPelement;
                let doubleCheck = false;
                for (const info of posData) {
                    const check = await utils.checkEndpointValue(position, info.endpoint);
                    console.log(`Check endpoint ${info.endpoint.info.name.get()} for position ${position.info.name.get()}: ${check}`);

                    if (check) {
                        info.CPelement.currentValue.set(true);
                        console.log(`Set CP for ${position.info.name.get()} to true`);
                        doubleCheck = true;
                        break;
                    }
                }
                if (!doubleCheck) {
                    CP.currentValue.set(false);
                    console.log(`Set command Control Point for position ${position.info.name.get()} to false`);
                }

                AllEndpoints.push(...posData);
            } catch (error) {
                console.error("Error processing position ", position.info.name.get(), error);
            }
        });

        await utils.BindGTBendPoint(AllEndpoints);
        console.log("Binding done for positions");
    }
    private async Room_alarm(): Promise<void> {     

         const context = await SpinalGraphService.getContext(process.env.RoomContext);
        if (!context) {
            throw new Error(`Context with name ${process.env.RoomContext} not found.`);
        }
         const category = (await context.getChildren("hasCategory")).find(cat => cat.info.name.get() === process.env.RoomCategory);
        
        if (!category) {
            throw new Error(`No category found in context ${process.env.RoomContext}.`);
        }
        const groups = await category.getChildren("hasGroup");
        if(groups.length === 0){
            throw new Error(`No groups found in category ${process.env.RoomCategory}.`);
        }
        const roomsArrays = await Promise.all(
            groups.map(group =>
                group.getChildren("groupHasgeographicRoom")
            )
        );
        const rooms: SpinalNode[] = roomsArrays.flat();
        console.log(`Found ${rooms.length} rooms.`);
            const AllEndpoints: InfoStore[] = [];  
            for (const room of rooms) {
                const roomData = await utils.getInfo(room, "hasBimObject");
                for (const info of roomData) {
                    const check = await utils.checkEndpointValue(room, info.endpoint);
                    console.log(`Check endpoint ${info.endpoint.info.name.get()} for room ${room.info.name.get()}: ${check}`);
                    if (check) {
                        info.CPelement.currentValue.set(true);
                        console.log(`Set CP for ${room.info.name.get()} to true`);
                    } else {
                        info.CPelement.currentValue.set(false);
                        console.log(`Set command Control Point for room ${room.info.name.get()} to false`);
                    }
                }
                AllEndpoints.push(...roomData);
            }
            await utils.BindGTBendPoint(AllEndpoints);
            console.log("Binding done for rooms");
    }

    public async MainJob() {
        await this.OpenSpace_alarm();
        await this.Room_alarm();
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