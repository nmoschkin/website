import React from 'react';
import { CompactCrew, GameEvent, PlayerData, Voyage, VoyageDescription } from '../model/player';
import { useStateWithStorage } from '../utils/storage';
import { DataContext, DataProviderProperties } from './datacontext';
import { BuffStatTable, calculateBuffConfig, calculateMaxBuffs } from '../utils/voyageutils';
import { prepareProfileData } from '../utils/crewutils';
import { Ship } from '../model/ship';
import { mergeShips } from '../utils/shiputils';
import { stripPlayerData } from '../utils/playerutils';
import { BossBattlesRoot } from '../model/boss';
import { ShuttleAdventure } from '../model/shuttle';
import { Archetype20, ArchetypeBase, Archetype17 } from '../model/archetype';

export interface PlayerContextData {
	loaded: boolean;
	setInput?: (value: PlayerData | undefined) => void;
	reset?: () => void;
	playerData?: PlayerData;
	ephemeral?: EphemeralData;
	strippedPlayerData?: PlayerData;
	playerShips?: Ship[];
	buffConfig?: BuffStatTable;
	maxBuffs?: BuffStatTable;
	dataSource?: string;
};

export interface EphemeralData {
	activeCrew: CompactCrew[];
	events: GameEvent[];
	fleetBossBattlesRoot: BossBattlesRoot;
	shuttleAdventures: ShuttleAdventure[];
	voyage: Voyage[],
	voyageDescriptions: VoyageDescription[];
};

export const defaultPlayer = {
	loaded: false,
	setInput: () => {},
	reset: () => {}
} as PlayerContextData;

export const PlayerContext = React.createContext<PlayerContextData>(defaultPlayer as PlayerContextData);

export const PlayerProvider = (props: DataProviderProperties) => {
	const coreData = React.useContext(DataContext);
	const { crew, ship_schematics } = coreData;

	const { children } = props;

	const [loaded, setLoaded] = React.useState(false);
	const [profile, setProfile] = React.useState<PlayerData | undefined>(undefined);

	const [stripped, setStripped] = useStateWithStorage<PlayerData | undefined>('playerData', undefined, { compress: true });
	const [input, setInput] = React.useState<PlayerData | undefined>(stripped);

	const [ephemeral, setEphemeral] = useStateWithStorage<EphemeralData | undefined>('ephemeralPlayerData', undefined, { compress: true });
	const [playerShips, setPlayerShips] = React.useState<Ship[] | undefined>(undefined);

	const buffConfig = stripped ? calculateBuffConfig(stripped.player) : undefined;
	const maxBuffs = stripped ? calculateMaxBuffs(stripped.player?.character?.all_buffs_cap_hash) : (coreData.all_buffs ?? undefined);

	const reset = (): void => {
		setStripped(undefined);
		setEphemeral(undefined);
		setProfile(undefined);
		setPlayerShips(undefined);
		setInput(undefined);
		setLoaded(false);
		sessionStorage.clear();
	};

	const context = {
		loaded,
		setInput,
		reset,
		playerData: profile,
		ephemeral,
		strippedPlayerData: stripped,
		playerShips,
		buffConfig,
		maxBuffs,
		dataSource: input?.stripped === true ? 'session' : 'input'
	} as PlayerContextData;

	React.useEffect(() => {
		if (!input || !ship_schematics.length || !crew.length) return;

		// ephemeral data (e.g. active crew, active shuttles, voyage data, and event data)
		//	can be misleading when outdated, so keep a copy for the current session only
		const activeCrew = [] as CompactCrew[];

		if (input.stripped !== true) {
			if (input.item_archetype_cache) {
				input.version = 17;
			}
			else if (input.archetype_cache) {
				input.version = 20;
				input.item_archetype_cache = {
					archetypes: input.archetype_cache.archetypes.map((a: Archetype20) => {
						return {
							...a as ArchetypeBase,
							type: a.item_type,
						} as Archetype17;
					})
				}
			}
		}

		input.player.character.crew.forEach(crew => {
			if (crew.active_status > 0) {
				activeCrew.push({ symbol: crew.symbol, rarity: crew.rarity, level: crew.level, equipment: crew.equipment.map((eq) => eq[0]), active_status: crew.active_status });
			}
		});

		if (input.stripped !== true) {
			setEphemeral({
				activeCrew,
				events: [...input.player.character.events ?? []],
				fleetBossBattlesRoot: input.fleet_boss_battles_root ?? {} as BossBattlesRoot,
				shuttleAdventures: [...input.player.character.shuttle_adventures ?? []],
				voyage: [...input.player.character.voyage ?? []],
				voyageDescriptions: [...input.player.character.voyage_descriptions ?? []]
			});
		}

		const dtImported = (typeof input.calc?.lastImported === 'string') ? new Date(input.calc?.lastImported) : new Date();

		// stripped is used for any storage purpose, i.e. sharing profile and keeping in session
		//	Ephmeral data is stripped from playerData here
		const strippedData = input.stripped ? input : stripPlayerData(coreData.items, {...input}) as PlayerData;
		strippedData.calc = input.calc ?? { 'lastImported': dtImported.toISOString() };

		if (input.stripped !== true) {
			setStripped({ ... JSON.parse(JSON.stringify(strippedData)), stripped: true });
		}

		// preparedProfileData is expanded with useful data and helpers for DataCore and hopefully generated once
		//	so other components don't have to keep calculating the same data
		// Pass playerData.profile as playerData to existing player tools
		let preparedProfileData = {...strippedData};
		prepareProfileData('PLAYER_CONTEXT', coreData.crew, preparedProfileData, dtImported);
		setProfile(preparedProfileData);

		if (preparedProfileData) {
			const schematics = JSON.parse(JSON.stringify(coreData.ship_schematics));
			const mergedShips = mergeShips(schematics, preparedProfileData.player.character.ships);
			setPlayerShips(mergedShips);
		}

		setLoaded(true);
	}, [input, crew, ship_schematics]);

	return (
		<PlayerContext.Provider value={context}>
			{children}
		</PlayerContext.Provider>
	);
};
