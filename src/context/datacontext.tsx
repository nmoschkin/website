import React from 'react';
import { Gauntlet } from '../model/gauntlets';
import { CrewMember } from '../model/crew';
import { Ship, Schematics, BattleStations } from '../model/ship';
import { EquipmentItem, EquipmentItemSource } from '../model/equipment';
import { Collection, Constellation, KeystoneBase, Polestar } from '../model/game-elements';
import { BuffStatTable, IBuffStat, calculateMaxBuffs } from '../utils/voyageutils';
import { Mission } from '../model/missions';
import { Icon } from 'semantic-ui-react';
import { navigate } from 'gatsby';

export type ValidDemands =
	'all_buffs' |
	'battle_stations' |
	'cadet' |
	'collections' |
	'crew' |
	'dilemmas' |
	'disputes' |
	'episodes' |
	'factions' |
	'gauntlets' |
	'items' |
	'keystones' |
	'misc_stats' |
	'missions' |
	'quests' |
	'ship_schematics' |
	'skill_bufs';

export interface DataProviderProperties {
	children: JSX.Element;
};

export interface ICoreData {
	all_buffs: BuffStatTable;
	battle_stations: BattleStations[];
	cadet: Mission[];
	collections: Collection[];
	crew: CrewMember[];
	episodes: Mission[];
	gauntlets: Gauntlet[];
	items: EquipmentItem[];
	keystones: (KeystoneBase | Polestar | Constellation)[];
	missions: Mission[];
	ship_schematics: Schematics[];
	ships: Ship[];
};

export interface ICoreContext extends ICoreData {
	ready: (demands: ValidDemands[]) => boolean;
	reset: () => boolean;
	spin: () => JSX.Element;
};

interface IDemandResult {
	demand: ValidDemands;
	json: any;
};

const defaultData = {
	all_buffs: {} as BuffStatTable,
	battle_stations: [] as BattleStations[],
	cadet: [] as Mission[],
	collections: [] as Collection[],
	crew: [] as CrewMember[],
	episodes: [] as Mission[],
	gauntlets: [] as Gauntlet[],
	items: [] as EquipmentItem[],
	keystones: [] as KeystoneBase[],
	missions: [] as Mission[],
	ship_schematics: [] as Schematics[],
	ships: [] as Ship[],
} as ICoreData;

export const defaultCore = {
	...defaultData,
	ready: () => { return false; },
	reset: () => { return false; },
	spin: () => { return <></>; }
} as ICoreContext;

export const DataContext = React.createContext<ICoreContext>(defaultCore as ICoreContext);

export const DataProvider = (props: DataProviderProperties) => {
	const { children } = props;

	const [isReadying, setIsReadying] = React.useState(false);
	const [data, setData] = React.useState<ICoreData>(defaultData);

	const spin = () => {
		return (<span><Icon loading name='spinner' /> Loading...</span>);
	};

	const providerValue = {
		...data,
		ready,
		reset,
		spin
	} as ICoreContext;

	return (
		<DataContext.Provider value={providerValue}>
			{children}
		</DataContext.Provider>
	);

	function ready(demands: ValidDemands[] = []): boolean {
		// Not ready if any valid demands are being processed
		if (isReadying) return false;

		// Fetch only if valid demand is not already satisfied
		const valid = [
			'all_buffs',
			'battle_stations',
			'cadet',
			'crew',
			'collections',
			'dilemmas',
			'disputes',
			'episodes',
			'factions',
			'gauntlets',
			'items',
			'keystones',
			'misc_stats',
			'missions',
			'quests',
			'ship_schematics',
			'skill_bufs',
		] as ValidDemands[];

		if (demands.includes('ship_schematics') && !demands.includes('battle_stations')) {
			demands.push('battle_stations');
		}

		// Identify unsatisfied demands
		const unsatisfied = [] as string[];
		demands.forEach(demand => {
			// this is a hack because BB uses all buffs but we don't always have player data
			// and our skill_bufs does not yet match BB data. So for now, we're ignoring them.
			if (demand === 'skill_bufs') demand = 'all_buffs';

			if (valid.includes(demand)) {
				if (data[demand].length === 0 || (demand === 'all_buffs' && !Object.keys(data[demand])?.length)) {
					unsatisfied.push(demand);
				}
			}
			else {
				console.log(`Invalid data demand: ${demand}`);
			}
		});

		// Ready only if all valid demands are satisfied
		if (unsatisfied.length === 0) return true;

		// Alert page that processing has started
		setIsReadying(true);

		// Fetch all unsatisfied demands concurrently
		Promise.all(unsatisfied.map(async (demand) => {
			let url = `/structured/${demand}.json`;
			if (demand === 'cadet') url = '/structured/cadet.txt';
			const response = await fetch(url);
			const json = await response.json();
			return { demand, json } as IDemandResult;
		})).then((results) => {
			const newData = {...data};

			// Process individual demands
			results.forEach(result => {
				console.log(`Demand '${result.demand}' loaded, processing ...`);
				switch (result.demand) {
					case 'all_buffs':
						newData.all_buffs = calculateMaxBuffs(result.json);
						break;
					case 'crew':
						newData.crew = processCrew(result.json);
						break;
					case 'gauntlets':
						newData.gauntlets = processGauntlets(result.json);
						break;
					// case 'skill_bufs':
					// 	newData.skill_bufs = processSkillBufs(result.json);
					// 	break;
					default:
						newData[result.demand] = result.json;
						break;
				}
			});

			// Post-process interdependent demands
			if (unsatisfied.includes('ship_schematics') && unsatisfied.includes('battle_stations')) {
				postProcessShipBattleStations(newData);
			}
			if (unsatisfied.includes('items') && unsatisfied.includes('cadet')) {
				postProcessCadetItems(newData);
			}

			setData({...newData});
		}).catch((error) => {
			console.log(error);
		}).finally(() => {
			// Alert page that processing is done (successfully or otherwise)
			setIsReadying(false);
		});

		return false;
	}

	function reset(): boolean {
		setData({ ...defaultData });
		return true;
	}

	function processCrew(result: CrewMember[]): CrewMember[] {
		result.forEach((item) => {
			item.action.cycle_time = item.action.cooldown + item.action.duration;
			if (typeof item.date_added === 'string') {
				item.date_added = new Date(item.date_added);
			}
		});
		return result;
	}

	function processGauntlets(result: Gauntlet[] | undefined): Gauntlet[] {
		result?.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
		return result ?? [];
	}

	// function processSkillBufs(result: any): BuffStatTable {
	// 	let sks = {} as BuffStatTable;
	// 	let skills = ['science', 'engineering', 'medicine', 'diplomacy', 'security', 'command'];
	// 	let types = ['core', 'range_min', 'range_max'];
	// 	for (let skill of skills) {
	// 		for (let type of types) {
	// 			let bkey = `${skill}_skill_${type}`;
	// 			sks[bkey] = {} as IBuffStat;
	// 			sks[bkey].percent_increase = result[skill][type];
	// 			sks[bkey].multiplier = 1;
	// 		}
	// 	}
	// 	return sks;
	// }

	function postProcessShipBattleStations(data: ICoreData): void {
		if (data.battle_stations.length && data.ship_schematics.length) {
			for (let sch of data.ship_schematics) {
				let battle = data.battle_stations.find(b => b.symbol === sch.ship.symbol);
				if (battle) {
					sch.ship.battle_stations = battle.battle_stations;
				}
			}

			let scsave = data.ship_schematics.map((sc => JSON.parse(JSON.stringify({ ...sc.ship, level: sc.ship.level + 1 })) as Ship));
			data.ships = scsave;
		}
	}

	function postProcessCadetItems(data: ICoreData): void {
		const cadetforitem = data.cadet?.filter(f => f.cadet);
		console.log("Finding cadet mission farm sources for items ...");

		if (cadetforitem?.length) {
			for(const item of data.items) {
				for (let ep of cadetforitem) {
					let quests = ep.quests.filter(q => q.quest_type === 'ConflictQuest' && q.mastery_levels?.some(ml => ml.rewards?.some(r => r.potential_rewards?.some(px => px.symbol === item.symbol))));
					if (quests?.length) {
						for (let quest of quests) {
							if (quest.mastery_levels?.length) {
								let x = 0;
								for (let ml of quest.mastery_levels) {
									if (ml.rewards?.some(r => r.potential_rewards?.some(pr => pr.symbol === item.symbol))) {
										let mx = ml.rewards.map(r => r.potential_rewards?.length).reduce((prev, curr) => Math.max(prev ?? 0, curr ?? 0)) ?? 0;
										mx = (1/mx) * 1.80;
										let qitem = {
											type: 4,
											mastery: x,
											name: quest.name,
											energy_quotient: 1,
											chance_grade: 5 * mx,
											mission_symbol: quest.symbol,
											cost: 1,
											avg_cost: 1/mx,
											cadet_mission: ep.episode_title,
											cadet_symbol: ep.symbol
										} as EquipmentItemSource;
										if (!item.item_sources.find(f => f.mission_symbol === quest.symbol)) {
											item.item_sources.push(qitem);
										}
									}
									x++;
								}
							}
						}
					}
				}
			}
		}

		console.log("Done with cadet missions.");
	}
};

export function randomCrew(symbol: string) {
	const { crew: allCrew } = this.context.core;
	if (!allCrew?.length) {
		return `${process.env.GATSBY_ASSETS_URL}crew_full_body_cm_qjudge_full.png`;
	}

	const rndcrew_pass1 = (allCrew.filter((a: CrewMember) => a.traits_hidden.includes(symbol) && a.max_rarity >= 4) ?? []) as CrewMember[];
	const rndcrew = [] as CrewMember[];

	for (let qc of rndcrew_pass1) {
		let max = 0;
		for (let sk of Object.values(qc.base_skills)) {
			max += sk.range_max;
		}
		if (max >= 800) {
			rndcrew.push(qc);
		}
	}

	const idx = Math.floor(Math.random() * (rndcrew.length - 1));
	const q = rndcrew[idx];
	const img = q.imageUrlFullBody;
	const fullurl = `${process.env.GATSBY_ASSETS_URL}${img}`;

	return <img style={{ height: "15em", cursor: "pointer" }} src={fullurl} onClick={(e) => navigate("/crew/" + q.symbol)} />
}
