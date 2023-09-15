import React from 'react';
import { Step, Icon } from 'semantic-ui-react';

import { CompactCrew, PlayerCrew } from '../../model/player';
import { Ship } from '../../model/ship';
import { IVoyageCrew } from '../../model/voyage';
import { GlobalContext } from '../../context/globalcontext';
import CONFIG from '../../components/CONFIG';
import { applyCrewBuffs } from '../../utils/crewutils';

type RosterPickerProps = {
	rosterType: string;
	setRosterType: (rosterType: string) => void;
	setRosterCrew: (rosterCrew: PlayerCrew[]) => void;
	setRosterShips: (rosterShips: Ship[]) => void;
};

export const RosterPicker = (props: RosterPickerProps) => {
	const globalContext = React.useContext(GlobalContext);
	const { playerData, playerShips, ephemeral } = globalContext.player;
	const { rosterType, setRosterType, setRosterCrew, setRosterShips } = props;

	const [allCrew, setAllCrew] = React.useState<IVoyageCrew[] | undefined>(undefined);
	const [myCrew, setMyCrew] = React.useState<IVoyageCrew[] | undefined>(undefined);
	const [allShips, setAllShips] = React.useState<Ship[] | undefined>(undefined);
	const [myShips, setMyShips] = React.useState<Ship[] | undefined>(undefined);

	React.useEffect(() => {
		let rosterCrew = [] as IVoyageCrew[];
		let rosterShips = [] as Ship[];

		if (rosterType === 'myCrew' && playerData) {
			if (myCrew && myShips) {
				setRosterCrew([...myCrew]);
				setRosterShips([...myShips]);
				return;
			}

			rosterCrew = rosterizeMyCrew(playerData.player.character.crew, ephemeral?.activeCrew ?? []);
			setMyCrew([...rosterCrew]);
			setRosterCrew([...rosterCrew]);

			rosterShips = rosterizeMyShips(playerShips ?? []);
			setMyShips([...rosterShips]);
			setRosterShips([...rosterShips]);
		}
		else {
			if (allCrew && allShips) {
				setRosterCrew([...allCrew]);
				setRosterShips([...allShips]);
				return;
			}
			let crewmanId = 1;
			globalContext.core.crew.forEach(crew => {
				const crewman = JSON.parse(JSON.stringify(crew)) as IVoyageCrew;
				crewman.id = crewmanId++;

				const buffedSkills = globalContext.maxBuffs ? applyCrewBuffs(crewman, globalContext.maxBuffs) : undefined;
				// Voyage calculator looks for skills, range_min, range_max properties
				if (buffedSkills) {
					crewman.skills = buffedSkills;
				}
				else {
					crewman.skills = {};
					CONFIG.SKILLS_SHORT.forEach((skill) => {
						if (crewman.base_skills[skill.name]) {
							crewman.skills[skill.name] = {
								core: crewman.base_skills[skill.name].core,
								range_max: crewman.base_skills[skill.name].range_max,
								range_min: crewman.base_skills[skill.name].range_min
							}
						}
					});
				}

				rosterCrew.push(crewman);
			});
			setAllCrew([...rosterCrew]);
			setRosterCrew([...rosterCrew]);

			globalContext.core.ships.forEach(ship => {
				const rosterShip = JSON.parse(JSON.stringify(ship));
				rosterShip.owned = true;
				rosterShip.level = rosterShip.max_level;
				rosterShip.antimatter += (50*rosterShip.max_level);
				rosterShips.push(rosterShip);
			});
			// Core ships is missing the default ship for some reason (1* Constellation Class), so manually add it here maxed
			const constellation = {
				symbol: 'constellation_ship',
				rarity: 1,
				level: 6,
				antimatter: 1250,
				name: 'Constellation Class',
				icon: { file: '/ship_previews_fed_constellationclass' },
				traits: ['federation','explorer'],
				owned: true
			} as Ship;
			rosterShips.push(constellation);

			setAllShips([...rosterShips]);
			setRosterShips([...rosterShips]);
		}
	}, [rosterType]);

	if (!playerData || !myCrew)
		return (<></>);

	return (
		<Step.Group fluid widths={2}>
			<Step active={rosterType === 'myCrew'} onClick={() => setRosterType('myCrew')}>
				<Icon name='users' />
				<Step.Content>
					<Step.Title>Owned Crew</Step.Title>
					<Step.Description>Only consider your owned crew</Step.Description>
				</Step.Content>
			</Step>
			<Step active={rosterType === 'allCrew'} onClick={() => setRosterType('allCrew')}>
				<Icon name='fire' />
				<Step.Content>
					<Step.Title>Best Possible Voyage</Step.Title>
					<Step.Description>Consider all ships and crew in the game</Step.Description>
				</Step.Content>
			</Step>
		</Step.Group>
	);
};

export function rosterizeMyCrew(myCrew: PlayerCrew[], activeCrew: CompactCrew[]): IVoyageCrew[] {
	const rosterCrew = [] as IVoyageCrew[];

	// Create fake ids for active crew based on rarity, level, and equipped status
	const activeCrewIds = activeCrew.map(ac => {
		return {
			id: ac.symbol+','+ac.rarity+','+ac.level+','+ac.equipment.join(''),
			active_status: ac.active_status
		};
	});

	let crewmanId = 1;
	myCrew.forEach(crew => {
		const crewman = JSON.parse(JSON.stringify(crew)) as IVoyageCrew;
		crewman.id = crewmanId++;

		// Voyage calculator looks for skills, range_min, range_max properties
		crewman.skills = {};
		CONFIG.SKILLS_SHORT.forEach((skill) => {
			if (crewman[skill.name].core > 0) {
				crewman.skills[skill.name] = {
					core: crewman[skill.name].core,
					range_max: crewman[skill.name].max,
					range_min: crewman[skill.name].min
				}
			}
		});

		// Re-attach active_status property
		crewman.active_status = 0;
		if (crew.immortal <= 0) {
			const activeCrewId = crew.symbol+','+crew.rarity+','+crew.level+','+crew.equipment.join('');
			const active = activeCrewIds.find(ac => ac.id === activeCrewId);
			if (active) {
				crewman.active_status = active.active_status ?? 0;
				active.id = '';	// Clear this id so that dupes are counted properly
			}
		}

		rosterCrew.push(crewman);
	});

	return rosterCrew;
}

export function rosterizeMyShips(myShips: Ship[]): Ship[] {
	const rosterShips = [] as Ship[];

	myShips.forEach(ship => {
		const rosterShip = JSON.parse(JSON.stringify(ship)) as Ship;
		rosterShips.push(rosterShip);
	});

	const ownedCount = myShips.length ?? 0;
	myShips.sort((a, b) => (a?.archetype_id ?? 0) - (b?.archetype_id ?? 0)).forEach((ship, idx) => {
		// Core ships is missing the default ship for some reason (1* Constellation Class), so manually add it here from playerData
		if (ship.symbol === 'constellation_ship') {
			const constellation = {
				symbol: ship.symbol,
				rarity: ship.rarity,
				level: ship.level,
				antimatter: ship.antimatter,
				name: 'Constellation Class',
				icon: { file: '/ship_previews_fed_constellationclass' },
				traits: ['federation','explorer'],
				owned: true
			} as Ship;
			rosterShips.push(constellation);
		}
		const myShip = rosterShips.find(s => s.symbol === ship.symbol);
		if (myShip) {
			myShip.id = ship.id;	// VoyageStats needs ship id to identify ship on existing voyage
			myShip.index = { left: (ownedCount-idx+1), right: idx-1 };
			if (idx === 0)
				myShip.index = { left: 1, right: ownedCount-1 };
			else if (idx === 1)
				myShip.index = { left: 0, right: 0 };
		}
	});

	return rosterShips;
}
