import React from "react";
import { CrewMember } from "../../model/crew";
import { PlayerData, PlayerCrew, CompletionState } from "../../model/player";
import { prepareOne, applyCrewBuffs, getSkills } from "../../utils/crewutils";
import { BuffStatTable } from "../../utils/voyageutils";
import { IDefaultGlobal } from "../../context/globalcontext";

export type PlayerBuffMode = 'none' | 'player' | 'max';

export type PlayerImmortalMode = 'owned' | 'min' | 2 | 3 | 4 | 'full' | 'frozen'

export const BuffNames = {
    'none': "Unboosted",
    'player': "Player Boosts",
    'max': "Max Boosts"
}

export const ImmortalNames = {
    "owned": "Owned",
    "min": "Unfused",
    "full": "Immortalized",
    2: "2 Stars", 
    3: "3 Stars", 
    4: "4 Stars", 
    "frozen": "Frozen",    
}

export function getAvailableBuffStates(playerData?: PlayerData, buffConfig?: BuffStatTable): PlayerBuffMode[] {
    const hasPlayer = !!playerData?.player?.character?.crew?.length;
    const hasBuff = (buffConfig && Object.keys(buffConfig)?.length) ? true : false;
    
    if (!hasPlayer && !hasBuff) return ['none'];
    else if (!hasPlayer) return ['none', 'max'];
    else return ['none', 'player', 'max'];
}

export function getAvailableImmortalStates(crew: PlayerCrew | CrewMember): PlayerImmortalMode[] {
    let v: PlayerImmortalMode[];
    
    if (!("rarity" in crew) || crew.have === false || crew.immortal === CompletionState.DisplayAsImmortalUnowned || crew.immortal === CompletionState.DisplayAsImmortalStatic) {
        if (crew.max_rarity === 5) v = ['min', 2, 3, 4, 'full'];
        else if (crew.max_rarity === 4) v = ['min', 2, 3, 'full'];
        else if (crew.max_rarity === 3) v = ['min', 2, 'full'];
        else if (crew.max_rarity === 2) v = ['min', 'full'];
        else v = ['full'];
    }
    else if (crew.immortal > 0) {
        return ['frozen'];
    }
    else if (crew.immortal <= -1) {
        return['full'];
    }
    else if (crew.rarity === crew.max_rarity && crew.immortal === 0) {
        v = ['owned', 'full'];
    }
    else {
        v ??= [];
        v.push('owned');

        for (let f = crew.rarity + 1; f < crew.max_rarity; f++) {
            if (f === 2 || f === 3 || f === 4) {
                v.push(f);
            }
        }

        v.push('full');
    }

    return v;
}

export function nextBuffState(current: PlayerBuffMode, playerData?: PlayerData, buffConfig?: BuffStatTable, backward?: boolean): PlayerBuffMode {
    const hasPlayer = !!playerData?.player?.character?.crew?.length;
    const hasBuff = (buffConfig && Object.keys(buffConfig)?.length) ? true : false;

    if (!hasPlayer && !hasBuff) return 'none';

    const allowed = getAvailableBuffStates(playerData, buffConfig);
    let x = allowed.indexOf(current);

    if (x === -1) x = 0;
    
    if (backward) {
        x--;
    }
    else {
        x++;
    }

    if (x < 0) x = allowed.length - 1;
    else if (x >= allowed.length) x = 0;
    
    return allowed[x];
}

export function nextImmortalCrewState(current: PlayerImmortalMode, crew: PlayerCrew | CrewMember, backward?: boolean): PlayerImmortalMode {    
    let v = getAvailableImmortalStates(crew);
    return nextImmortalState(current, v, backward);
}

export function nextImmortalState(current: PlayerImmortalMode, modes: PlayerImmortalMode[], backward?: boolean): PlayerImmortalMode {    
    let z = modes.indexOf(current);
    
    if (z !== -1) {
        if (backward) z--;
        else z++;
        
        if (z < 0) z = modes.length - 1;
        else if (z >= modes.length) z = 0;

        return modes[z];
    }

    return current;
}



export function applyImmortalState(state: PlayerImmortalMode, reference: CrewMember, playerData?: PlayerData, buffConfig?: BuffStatTable) {
    let pres: PlayerCrew[];
    if (state === 'owned') {
        pres = prepareOne(reference, playerData, buffConfig);
    }
    else if (state === 'full' || state === 'frozen') {
        pres = prepareOne(reference, playerData, buffConfig, 6);
    }
    else if (state === 'min') {
        pres = prepareOne(reference, playerData, buffConfig, 1);
    }
    else {
        pres = prepareOne(reference, playerData, buffConfig, state);
    }
    
    return pres[0];
}

export class CrewPreparer {
    
    public static prepareCrewMember(
        dataIn: PlayerCrew | CrewMember | undefined,
        buffMode: PlayerBuffMode,
        immortalMode: PlayerImmortalMode,
        context: IDefaultGlobal
    ): [PlayerCrew | CrewMember | undefined, PlayerImmortalMode[] | undefined] {

        const { buffConfig, maxBuffs, playerData } = context.player;
        const hasPlayer = !!playerData?.player?.character?.crew?.length;

        let immoMode: PlayerImmortalMode[] | undefined = undefined;

        if (dataIn) {            
            let item: PlayerCrew;

            if (hasPlayer) {
                item = playerData.player.character.crew.find((xcrew) => xcrew.symbol === dataIn.symbol) ?? dataIn as PlayerCrew;
                item = { ...dataIn, ...item };
            }
            else {
                item = dataIn as PlayerCrew;
            }

            item = JSON.parse(JSON.stringify(item)) as PlayerCrew;
            immoMode = getAvailableImmortalStates(item);
            
            if (immortalMode !== 'owned' || (buffMode !== 'none')) {
                let cm: CrewMember | undefined = undefined;
                cm = context.core.crew.find(c => c.symbol === dataIn.symbol);
                if (cm) {
                    if (item.immortal === CompletionState.DisplayAsImmortalStatic) {
                        item = applyImmortalState(immortalMode, cm, undefined, buffConfig ?? maxBuffs);
                    }
                    else {
                        item = applyImmortalState(immortalMode, cm, context.player.playerData, buffConfig ?? maxBuffs);
                    }
                    
                    if ((maxBuffs && Object.keys(maxBuffs)?.length) && ((!hasPlayer && buffMode != 'none') || (buffMode === 'max'))) {
                        applyCrewBuffs(item, maxBuffs);
                        getSkills(item).forEach(skill => {
                            let sb = item[skill] ?? { core: 0, min: 0, max: 0 };
                            item[skill] = sb;
                        })
                    }
                    else if (buffMode === 'player' && hasPlayer && immortalMode === 'owned' && item.skills && Object.keys(item.skills)?.length) {
                        getSkills(item).forEach(skill => {
                            let sb = item[skill] ?? { core: 0, min: 0, max: 0 };
                            item[skill] = {
                                core: item.skills[skill].core,
                                min: item.skills[skill].range_min,
                                max: item.skills[skill].range_max,
                            };
                            });
                    }
                    else if (hasPlayer && buffConfig && buffMode === 'player') {
                        applyCrewBuffs(item, buffConfig);
                        getSkills(item).forEach(skill => {
                            let sb = item[skill] ?? { core: 0, min: 0, max: 0 };
                            item[skill] = sb;
                        });
                    }
                    else {
                        getSkills(item).forEach(skill => {
                            let sb = item.base_skills[skill];
                            item[skill] = {
                                core: sb.core,
                                min: sb.range_min,
                                max: sb.range_max
                            }
                            })
                        }
                }
            }
            else {
                item = JSON.parse(JSON.stringify(item));
                getSkills(item).forEach(skill => {
                    let sb = item.base_skills[skill];
                    item[skill] = {
                        core: sb.core,
                        min: sb.range_min,
                        max: sb.range_max
                    }
                    })
            }

            return [item, immoMode];
        }        

        return [dataIn, []];
    }
}
