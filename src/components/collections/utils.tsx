import React from 'react';

import { CrewMember } from "../../model/crew";
import { CompletionState, PlayerCollection, PlayerCrew, PlayerData } from "../../model/player";
import { useStateWithStorage } from '../../utils/storage';
import { TinyStore } from '../../utils/tiny';
import { getCollectionRewards } from '../../utils/itemutils';
import { neededStars, starCost } from '../../utils/crewutils';
import { GlobalContext } from '../../context/globalcontext';

export interface MapFilterOptions {
	collectionsFilter?: number[];
	rewardFilter?: string[];
}

export interface CollectionMap {
	collection: PlayerCollection;
	crew: PlayerCrew[];
	neededStars?: number[];
	completes: boolean;
}

export interface CollectionGroup {
	name: string;
	maps: CollectionMap[];
	uniqueCrew: PlayerCrew[];
	commonCrew: PlayerCrew[];
	collection: PlayerCollection;
	nonfullfilling?: number;
	nonfullfillingRatio?: number;
	neededStars?: number[];
	uniqueCost?: number;
	combos?: string[][];
}

// const [ownedFilter, setOwnedFilter] = useStateWithStorage('collectionstool/ownedFilter', '');
// const [fuseFilter, setFuseFilter] = useStateWithStorage('collectionstool/fuseFilter', '');
// const [rarityFilter, setRarityFilter] = useStateWithStorage('collectionstool/rarityFilter', [] as number[]);
// const [searchFilter, setSearchFilter] = useStateWithStorage('collectionstool/searchFilter', '');

export interface CollectionFilterProps {
    short: boolean;	
    setShort: (value: boolean) => void;

    mapFilter: MapFilterOptions;	
    setMapFilter: (options: MapFilterOptions) => void;
    
    searchFilter: string;
    setSearchFilter: (value?: string) => void;

    rarityFilter: number[];
    setRarityFilter: (value: number[]) => void;

    fuseFilter: string;
    setFuseFilter: (value?: string) => void;

    ownedFilter: string;
    setOwnedFilter: (value?: string) => void;

    checkCommonFilter: (crew: PlayerCrew, exclude?: string[]) => boolean;
    checkRewardFilter: (collection: PlayerCollection, filters: string[]) => boolean;
};

const DefaultData = {
    mapFilter: {} as MapFilterOptions,
    searchFilter: '',
    rarityFilter: [],
    fuseFilter: '',
    ownedFilter: '',
    short: false,
    setMapFilter: (value) => null,
    setSearchFilter: (value) => null,
    setRarityFilter: (value) => null,
    setFuseFilter: (value) => null,
    setOwnedFilter: (value) => null,
    checkCommonFilter: (value) => false,
    checkRewardFilter: (value) => false,
    setShort: (value) => false,
} as CollectionFilterProps;

export const CollectionFilterContext = React.createContext<CollectionFilterProps>(DefaultData);

export interface CollectionFiltersProps {
    pageId: string;
    playerCollections: PlayerCollection[];
    children: JSX.Element;
}

export const CollectionFilterProvider = (props: CollectionFiltersProps) => {
    const context = React.useContext(GlobalContext);
    const { children, pageId, playerCollections } = props;
	const tinyCol = TinyStore.getStore('collections');   

	const offsel = tinyCol.getValue<string | undefined>(pageId + "/selectedCollection");
	const selColId = playerCollections.find(f => f.name === offsel)?.id;
	const defaultMap = {
		collectionsFilter: selColId !== undefined ? [selColId] : [] as number[],
		rewardFilter: []
	} as MapFilterOptions;

    const [ownedFilter, setOwnedFilter] = useStateWithStorage(pageId + 'collectionstool/ownedFilter', '');
    const [fuseFilter, setFuseFilter] = useStateWithStorage(pageId + 'collectionstool/fuseFilter', '');
    const [rarityFilter, setRarityFilter] = useStateWithStorage(pageId + 'collectionstool/rarityFilter', [] as number[]);
    const [searchFilter, setSearchFilter] = useStateWithStorage(pageId + 'collectionstool/searchFilter', '');
    const [mapFilter, setMapFilter] = useStateWithStorage(pageId + 'collectionstool/mapFilter', defaultMap);
	const [short, internalSetShort] = useStateWithStorage('collectionstool/colGroupShort', false, { rememberForever: true });

    const checkCommonFilter = (crew: PlayerCrew, exclude?: string[]) => {
		if (!exclude?.includes('unowned') && ownedFilter === 'unowned' && (crew.highest_owned_rarity ?? 0) > 0) return false;
		if (!exclude?.includes('owned') && ownedFilter.slice(0, 5) === 'owned' && crew.highest_owned_rarity === 0) return false;
		if (!exclude?.includes('owned-impact') && ownedFilter === 'owned-impact' && (crew.max_rarity - (crew.highest_owned_rarity ?? crew.rarity ?? 0)) !== 1) return false;
		if (!exclude?.includes('owned-ff') && ownedFilter === 'owned-ff' && crew.max_rarity !== (crew.highest_owned_rarity ?? crew.rarity)) return false;
		if (!exclude?.includes('rarity') && rarityFilter.length > 0 && !rarityFilter.includes(crew.max_rarity)) return false;
		if (!exclude?.includes('portal') && fuseFilter.slice(0, 6) === 'portal' && !crew.in_portal) return false;
		if (!exclude?.includes('portal-unique') && fuseFilter === 'portal-unique' && !crew.unique_polestar_combos?.length) return false;
		if (!exclude?.includes('portal-nonunique') && fuseFilter === 'portal-nonunique' && crew.unique_polestar_combos?.length !== 0) return false;
		if (!exclude?.includes('nonportal') && fuseFilter === 'nonportal' && crew.in_portal) return false;
		return true;
	}

    const checkRewardFilter = (collection: PlayerCollection, filters: string[]) => {
		let result = false;

		for (let rewardFilter of filters) {
			let q = true;

			if (rewardFilter && rewardFilter != '*any') {
				let re: RegExp;
				if (rewardFilter == '*buffs') {
					if (collection.milestone?.buffs?.length == 0) q = false;
				}
				else if (rewardFilter.slice(0, 1) == '=') {
					re = new RegExp(rewardFilter.slice(1));
					if (!collection.milestone.rewards?.find(reward => reward.symbol && re.test(reward.symbol))) q = false;
				}
				else if (!collection.milestone.rewards?.find(reward => reward.symbol == rewardFilter)) {
					return q = false;
				}
			}	
			result ||= q;
		}

		return result;
	}

    const data = {
        mapFilter,
        searchFilter,
        rarityFilter,
        fuseFilter,
        ownedFilter,
        setMapFilter,
        setSearchFilter,
        setRarityFilter,
        setFuseFilter,
        setOwnedFilter,
        checkCommonFilter,
        checkRewardFilter,
        short,
        setShort: internalSetShort,
    } as CollectionFilterProps;

    return (<CollectionFilterContext.Provider value={data}>
            {children}    
        </CollectionFilterContext.Provider>)
} 








