import { SemanticICONS } from 'semantic-ui-react';
import { PlayerCrew } from '../../model/player';

// Stripped down version of GameData extended for use in Event Planner and Shuttle Helper
export interface IEventData {
	symbol: string;
	name: string;
	description: string;
	bonus_text: string;
	content_types: string[];	/* shuttles, gather, etc. */
	seconds_to_start: number;
	seconds_to_end: number;
	image: string;
	bonus: string[];	/* ALL bonus crew by symbol */
	featured: string[];	/* ONLY featured crew by symbol */
	bonusGuessed?: boolean;
};

export interface IRosterCrew extends PlayerCrew {
	shared?: boolean;
	statusIcon?: SemanticICONS;
};

export interface IEventScoredCrew extends IRosterCrew {
	combos: IEventCombos;
	bestSkill: IEventSkill;
	bestPair: IEventPair;
};

export interface IEventCombos {
	[key: string]: number;
};

export interface IEventSkill {
	score: number;
	skill: string;
};

export interface IEventPair {
	score: number;
	skillA: string;
	skillB: string;
};

export interface IBestCombo {
	id: number;
	score: number;
};

export interface IBestCombos {
	[key: string]: IBestCombo;
};
