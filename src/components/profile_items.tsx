import { Link, navigate } from 'gatsby';
import React, { Component } from 'react';
import { Checkbox, Dropdown, DropdownItemProps, Icon, Input, Pagination, Rating, SemanticWIDTHS, Table } from 'semantic-ui-react';


import { UnifiedWorker } from '../typings/worker';
import { IConfigSortData, IResultSortDataBy, sortDataBy } from '../utils/datasort';
import { exportItemsAlt, getItemBonuses, isQuipmentMatch } from '../utils/itemutils';

import CONFIG from '../components/CONFIG';
import { GlobalContext } from '../context/globalcontext';
import { CrewMember } from '../model/crew';
import { EquipmentCommon, EquipmentItem } from '../model/equipment';
import { PlayerBuffMode, PlayerCrew } from '../model/player';
import { EquipmentWorkerConfig, EquipmentWorkerResults } from '../model/worker';
import { applyCrewBuffs, downloadData, oneCrewCopy, qbitsToSlots, shortToSkill, skillToShort } from '../utils/crewutils';
import { calcItemDemands, canBuildItem } from '../utils/equipment';
import { appelate } from '../utils/misc';
import { TinyStore } from '../utils/tiny';
import { CrewHoverStat } from './hovering/crewhoverstat';
import { ItemHoverStat } from './hovering/itemhoverstat';
import { CrewItemsView } from './item_presenters/crew_items';
import { CrewPreparer } from './item_presenters/crew_preparer';
import { CrewPresenter } from './item_presenters/crew_presenter';
import { renderBonuses } from './item_presenters/item_presenter';
import ItemDisplay from './itemdisplay';
import { DEFAULT_MOBILE_WIDTH } from './hovering/hoverstat';

export interface CustomFieldDef {
	field: string;
	text: string;
	format?: (value: any) => string;
	width?: SemanticWIDTHS;
}

type ProfileItemsProps = {
	/** List of equipment items */
	data?: EquipmentCommon[] | EquipmentItem[];

	/** Optional alternative navigation method */
	navigate?: (symbol: string) => void;

	/** Hide features for owned items */
	hideOwnedInfo?: boolean;

	/** Hide search bar */
	hideSearch?: boolean;

	/** Add needed but unowned items to list */
	addNeeded?: boolean;

	pageName?: string;

	noRender?: boolean;

	/** Do not run the worker */
	noWorker?: boolean;

	/** Put flavor in its own column. */
	flavor?: boolean;

	/** Put buffs in its own column. */
	buffs?: boolean;

	crewMode?: boolean;

	types?: number[];

	itemTargetGroup?: string;

	crewTargetGroup?: string;

	customFields?: CustomFieldDef[];

	init_rows?: number;
};

interface ItemSearchOpts {
	filterText?: string;
	itemType?: number[];
	rarity?: number[];
}

export type CrewType = 'all' | 'owned' | 'quippable' | 'frozen';

interface CrewKwipTrial {
	symbol: string;
	kwipment: number[];
	kwipment_expiration: number[];
}

type OwnedType = 'all' | 'owned' | 'buildable' | 'both';

type ProfileItemsState = {
	column: any;
	direction: 'descending' | 'ascending' | null;
	data?: (EquipmentCommon | EquipmentItem)[];
	filteredData?: (EquipmentCommon | EquipmentItem)[];
	searchOpts?: ItemSearchOpts;
	pagination_rows: number;
	pagination_page: number;

	/** Add needed but unowned items to list */
	addNeeded?: boolean;
	crewSelection: string;
	crewType: CrewType;
	traits?: string[];
	skills?: string[];
	trials?: CrewKwipTrial[];
	ownedQuipment?: OwnedType;
	ignoreLimit?: boolean;
};

export function printRequiredTraits(item: EquipmentCommon): JSX.Element {

	if (item.kwipment) {
		if (item.traits_requirement?.length) {
			let req = item.traits_requirement.map(t => t === 'doctor' ? 'physician' : t);
			if (item.traits_requirement_operator === "and") {
				return <Link to={`/?search=trait:${req.reduce((p, n) => p ? `${p},${n}` : n)}&filter=Whole%20word`}>
					{req.map(t => appelate(t)).join(` ${item.traits_requirement_operator} `)}
				</Link>
			}
			else {
				return <>{req.map(t => <Link to={`/?search=trait:${t}&filter=Whole%20word`}>{appelate(t)}</Link>).reduce((p, n) => p ? <>{p} {item.traits_requirement_operator} {n}</> : n)}</>
			}
		}
	}

	return <></>
};

const pagingOptions = [
	{ key: '0', value: 10, text: '10' },
	{ key: '1', value: 25, text: '25' },
	{ key: '2', value: 50, text: '50' },
	{ key: '3', value: 100, text: '100' }
];

class ProfileItems extends Component<ProfileItemsProps, ProfileItemsState> {
	static contextType = GlobalContext;
	context!: React.ContextType<typeof GlobalContext>;
	readonly tiny: TinyStore;
	private lastData: (EquipmentCommon | EquipmentItem)[] | undefined;

	constructor(props: ProfileItemsProps) {
		super(props);
		this.tiny = TinyStore.getStore((props.pageName ? props.pageName + "_" : "") + 'profile_items');

		this.state = {
			crewType: this.tiny.getValue<CrewType>('crewType') ?? 'quippable',
			crewSelection: this.tiny.getValue<string>('crewSelection') ?? '',
			column: null,
			direction: null,
			searchOpts: this.tiny.getValue('searchOptions'),
			pagination_rows: props.init_rows ?? this.tiny.getValue<number>('pagination_rows', 10) ?? 10,
			pagination_page: 1,
			data: props.data,
			addNeeded: props.addNeeded ?? this.tiny.getValue<boolean>('addNeeded', false),
			ownedQuipment: 'all'
		};
		
		this.lastData = undefined;
	}

	private setCrewSelection = (value: string) => {
		this.tiny.setValue('crewSelection', value);
		if (value === '') {
			this.setState({ ... this.state, crewSelection: value, trials: [] });
		}
		else {
			this.setState({ ... this.state, crewSelection: value });
		}

	}

	private setRows = (value: number) => {
		this.tiny.setValue('pagination_rows', value, true);
		this.setState({ ...this.state, pagination_rows: value, pagination_page: 1 });
	}

	private setCrewType = (value: CrewType) => {
		this.tiny.setValue('crewType', value);
		this.setState({ ... this.state, crewType: value, crewSelection: '' });
	}

	private findFirstCrew = (symbol: string) => {
		const { playerData } = this.context.player;
		const { crewType } = this.state;
		let found = playerData?.player.character.crew.find(d => {
			if (d.symbol !== symbol) return false;

			if (crewType === 'frozen') {
				if (!d.immortal || d.immortal <= 0) return false;
			}
			else if (crewType === 'quippable') {
				if (!d.q_bits || d.q_bits < 100) return false;
			}
			else {
				if (d.immortal !== -1) return false;
			}

			return true;
		});		

		return found;	
	}

	private makeCrewChoices = () => {
		const crewChoices = [] as DropdownItemProps[];
		const { crew } = this.context.core;
		const { playerData } = this.context.player;
		const { crewType, skills, traits } = this.state;

		let data = this._getFilteredItems(true) as EquipmentItem[];

		if (this.props?.crewMode && crew?.length) {
			[...crew].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
				if (playerData && ['owned', 'quippable', 'frozen'].includes(crewType)) {
					if (!this.findFirstCrew(c.symbol)) return;
				}

				if (skills?.length) {
					if (!skills.some(skill => (shortToSkill(skill?.toUpperCase()) ?? '') in c.base_skills)) return;
				}

				if (traits?.length) {
					if (!traits.includes("any") && !traits.includes("none")) {
						if (!traits.some(trait => c.traits.includes(trait) || c.traits_hidden.includes(trait))) return;
					}
					else if (data && traits.includes("any")) {
						if (!data.some(d => isQuipmentMatch(c, d))) return;
					}
				}

				crewChoices.push(
					{
						key: c.symbol,
						value: c.symbol,
						text: c.name,
						content: <React.Fragment>
							<div style={{
								display: 'grid',
								gridTemplateColumns: '48px auto',								
								gridTemplateAreas: "'img text' 'img rarity'",
							}}>
								<img src={`${process.env.GATSBY_ASSETS_URL}${c.imageUrlPortrait}`}
									 style={{
										height: "32px",
										gridArea: 'img'
									}}/>
								<div style={{
									gridArea: 'text',
									textAlign: 'left',
									marginBottom: "0.25em"
									}}>
										{c.name}
								</div>
								<div style={{gridArea: 'rarity'}}>
									<Rating icon={'star'} maxRating={c.max_rarity} rating={c.max_rarity} size={'tiny'} />
								</div>								
							</div>
						</React.Fragment>,
						// image: { avatar: true, src: `${process.env.GATSBY_ASSETS_URL}${c.imageUrlPortrait}` },
						// text: c.name
					});
			});
		}
		return crewChoices;
	};

	private runWorker() {
		const worker = new UnifiedWorker();
		const { playerData } = this.context.player;

		const items = this.context.core.items;
		const { addNeeded } = this.state;

		var me = this;

		if (playerData?.calculatedDemands?.length) {
			let data = [...playerData.calculatedDemands];

			if (addNeeded) {
				data.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
				me.setState({
					... this.state,
					data,
					column: 'quantity',
					direction: 'ascending',
					pagination_page: 1
				});
			}
			else {
				me.setState({ ... this.state, data });
			}
			return;
		}

		worker.addEventListener('message', (message: { data: { result: EquipmentWorkerResults } }) => {
			if (playerData) playerData.calculatedDemands = message.data.result.items as EquipmentItem[];
			let data = [...message.data.result.items];

			if (addNeeded) {
				data.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
				me.setState({ ... this.state, data, column: 'quantity', direction: 'ascending', pagination_page: 1 });
			}
			else {
				me.setState({ ... this.state, data });
			}
		});

		worker.postMessage({
			worker: 'equipmentWorker',
			config: {
				playerData,
				items,
				addNeeded: this.state.addNeeded
			} as EquipmentWorkerConfig
		});
	}
	componentDidMount() {
		this.initData();
	}

	componentDidUpdate(prevProps: Readonly<ProfileItemsProps>, prevState: Readonly<ProfileItemsState>, snapshot?: any): void {
		if (this.props.data && this.props.data !== this.state.data) {
			this.setState({ ... this.state, data: this.props.data });
		}
		else {
			this.initData();
		}
	}

	initData() {
		const { playerData } = this.context.player;

		if (playerData) {
			if (playerData.calculatedDemands && this.state.data?.length && this.state.data?.length > 0) return;
		}

		const { items, crew } = this.context.core;
		if (!items || !crew) return;

		if (this.state.data?.length && this.lastData === this.state.data) {
			return;
		}
		else {
			this.lastData = this.state.data;
		}

		if (!this.props.noWorker) {
			this.runWorker();
		}
		else if (this.props.data?.length) {
			this.setState({ ...this.state, data: this.props.data })
		}
	}

	private _onChangePage(activePage) {
		this.setState({ pagination_page: activePage });
	}

	private makeTrialCrew = (crew: PlayerCrew) => {
		if (!crew) return undefined;

		crew = oneCrewCopy({ ... this.context.core.crew.find(f => f.symbol === crew.symbol) as PlayerCrew, ...crew }) as PlayerCrew;

		if (crew.level === undefined || crew.rarity === undefined) {
			crew.kwipment = [0, 0, 0, 0];
			crew.kwipment_expiration =  [0, 0, 0, 0];
			crew.rarity = crew.max_rarity;
			crew.level = 100;
			crew.skills = crew.base_skills;
			crew.q_bits = 1300;
		}
		else if (crew.immortal > 0) {
			crew.q_bits = 1300;
		}

		if (this.state.ignoreLimit) {
			crew.q_bits = 1300;
		}

		let trial = this.state.trials?.find(f => f.symbol === crew.symbol)

		if (!trial) {
			trial = {
				symbol: crew.symbol,
				kwipment: crew.kwipment.map((k: number | number[]) => typeof k === 'number' ? k : k[1]).filter(n => !!n),
				kwipment_expiration: crew.kwipment_expiration.map((k: number | number[]) => typeof k === 'number' ? k : k[1]).filter(n => !!n)
			} as CrewKwipTrial;

			let trials = [...this.state.trials ?? []];
			trials.push(trial);
			window.setTimeout(() => {
				this.setState({ ... this.state, trials });
			});
		}
		if (trial) {
			let slots = qbitsToSlots(crew?.q_bits ?? 0);
			crew.kwipment = trial.kwipment?.slice(0, slots) ?? [];
			crew.kwipment_expiration = trial.kwipment_expiration?.slice(0, slots) ?? [];
			slots = 4 - crew.kwipment.length;
			for (let i = 0; i < slots; i++) {
				crew.kwipment.push(0);
			}
		}

		return CrewPreparer.prepareCrewMember(crew, 'quipment', 'full', this.context, true)[0];
	}

	private maxTrial(crew: PlayerCrew) {
		let trials = this.state.trials ?? [];
		let currtrial = trials.find(t => t.symbol === crew.symbol) ?? { symbol: crew, kwipment: [] };
		if (currtrial) {
			return currtrial.kwipment.length >= qbitsToSlots(crew.q_bits ?? 0);
		}
		return false;
	}

	private getTrial(crew: string, item: number) {
		let trials = this.state.trials ?? [];
		let currtrial = trials.find(t => t.symbol === crew) ?? { symbol: crew, kwipment: [], kwipment_expiration: [] };
		if (currtrial) {
			currtrial = { ...currtrial };

			if (currtrial.kwipment?.includes(item)) {
				return true;
			}
		}
		return false;
	}

	private setTrial(crew: string, item: number, state: boolean) {
		let trials = this.state.trials ?? [];
		let currtrial = trials.find(t => t.symbol === crew) ?? { symbol: crew, kwipment: [], kwipment_expiration: [] };

		if (currtrial) {
			currtrial = { ...currtrial };

			if (currtrial.kwipment?.includes(item) && state === false) {
				let n = currtrial.kwipment.indexOf(item);
				currtrial.kwipment = currtrial.kwipment?.filter(f => f !== item) ?? [];
				currtrial.kwipment_expiration = currtrial.kwipment_expiration.filter((f, idx) => idx !== n);
			}
			else if (!currtrial.kwipment?.includes(item) && state === true) {
				currtrial.kwipment ??= [];
				currtrial.kwipment_expiration ??= [];
				currtrial.kwipment.push(item);
				currtrial.kwipment_expiration.push(0);
			}
			trials = trials.filter(f => f.symbol !== crew);
			trials.push(currtrial);
			// if (currtrial.kwipment.length) {
			// 	trials.push(currtrial);
			// }
		}

		this.setState({ ...this.state, trials });
	}

	private _handleSort(clickedColumn) {
		const { column, direction } = this.state;
		let { data } = this.state;
		if (!data) return;

		const sortConfig: IConfigSortData = {
			field: clickedColumn,
			direction: clickedColumn === column ? direction : (clickedColumn === 'quantity' ? 'ascending' : null)
		};

		if (clickedColumn === 'buffs') {
			if (clickedColumn === column) {
				sortConfig.direction = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
			}
			else {
				sortConfig.direction = direction ?? 'ascending';
			}

			const factor = sortConfig.direction === 'ascending' ? 1 : -1;

			data.sort((a, b) => {
				let abonus = a.bonuses ?? {};
				let bbonus = b.bonuses ?? {};

				let askills = Object.values(abonus).reduce((p, n) => p + n, 0);
				let bskills = Object.values(bbonus).reduce((p, n) => p + n, 0);

				return (askills - bskills) * factor;
			});

			this.setState({
				column: sortConfig.field,
				direction: sortConfig.direction,
				pagination_page: 1,
				data
			});

			return;
		}

		const sorted: IResultSortDataBy = sortDataBy(data, sortConfig);

		this.setState({
			column: sorted.field,
			direction: sorted.direction,
			pagination_page: 1,
			data: sorted.result
		});
	}

	private _handleNavigate = (symbol: string) => {
		if (this.props.navigate) {
			this.props.navigate(symbol);
		}
		else {
			navigate("/item_info?symbol=" + symbol);
		}
	}

	private _handleFilter = (text: string | undefined) => {
		const searchOpts = { ...(this.state.searchOpts ?? {}), filterText: text ?? '' };
		this.tiny.setValue('searchOptions', searchOpts);

		this.setState({ ...this.state, searchOpts, pagination_page: 1 });
	}

	private _handleTraits = (values: string[] | undefined) => {
		if (values?.length) {
			if (values[values.length - 1] === 'none') {
				values = ['none'];
			}
			else if (values[values.length - 1] === 'any') {
				values = ['any'];
			}
			else if (values.some(v => v !== 'none' && v !== 'any')) {
				values = values.filter(v => v !== 'none' && v !== 'any');
			}
			else if (values?.includes('none')) {
				values = ['none'];
			}
			else if (values?.includes('any')) {
				values = ['any'];
			}
		}

		const searchOpts = { ...(this.state.searchOpts ?? {}), filterText: !!values?.length ? "trait:" + values?.join(",") : '' };
		this.tiny.setValue('searchOptions', searchOpts);

		this.setState({ ...this.state, searchOpts, traits: values, skills: [], pagination_page: 1 });
	}

	private _handleSkills = (values: string[] | undefined) => {
		const searchOpts = { ...(this.state.searchOpts ?? {}), filterText: !!values?.length ? "skill:" + values?.join(",") : '' };
		this.tiny.setValue('searchOptions', searchOpts);

		this.setState({ ...this.state, searchOpts, skills: values, traits: [], pagination_page: 1 });
	}

	private _handleItemType = (values: number[] | undefined) => {
		const searchOpts = { ...(this.state.searchOpts ?? {}), itemType: values };
		this.tiny.setValue('searchOptions', searchOpts);
		this.setState({ ...this.state, searchOpts, pagination_page: 1 });
	}

	private _handleRarity = (values: number[] | undefined) => {
		const searchOpts = { ...(this.state.searchOpts ?? {}), rarity: values };
		this.tiny.setValue('searchOptions', searchOpts);
		this.setState({ ...this.state, searchOpts, pagination_page: 1 });
	}

	private _handleOwned = (value: OwnedType) => {
		this.tiny.setValue('ownedQuipment', value, true);
		this.setState({ ...this.state, ownedQuipment: value });
	}

	private _handleAddNeeded = (value: boolean | undefined) => {
		if (this.state.addNeeded === value) return;
		const { playerData } = this.context.player;

		if (playerData) {
			delete playerData.calculatedDemands;
		}

		this.tiny.setValue('addNeeded', value ?? false);
		this.setState({ ... this.state, data: undefined, addNeeded: value ?? false });
	}

	private _getFilteredItems(ignoreCrewSelection?: boolean) {

		const { ownedQuipment, crewSelection } = this.state;
		let data = [...this.state.data ?? []];

		const filterText = this.state.searchOpts?.filterText?.toLocaleLowerCase();
		const { types, crewMode } = this.props;

		const { rarity, itemType } = this.state.searchOpts ?? {};
		const { playerData } = this.context.player;

		if ((filterText && filterText !== '') || !!rarity?.length || !!itemType?.length || !!types?.length || !!crewSelection?.length) {

			data = data.filter(f => {

				if (ownedQuipment !== 'all' && f.type === 14 && playerData) {
					let g = f as EquipmentItem;
					if (!g.demands?.some(d => d.have)) {
						g.demands = calcItemDemands(g, this.context.core.items, playerData.player.character.items);
					}
					if (ownedQuipment === 'both') {
						if (!canBuildItem(g, true) && !playerData.player.character.items.some((item) => item.archetype_id?.toString() === f.kwipment_id?.toString())) return false;
					}
					else if (ownedQuipment === 'buildable') {
						if (!canBuildItem(g, true)) return false;
					}
					else if (ownedQuipment === 'owned') {
						if (!playerData.player.character.items.some((item) => item.archetype_id?.toString() === f.kwipment_id?.toString())) return false;
					}
				}

				let textPass = true;
				let rarePass = true;
				let itemPass = true;
				let crewPass = true;

				if (!!types?.length && !types.includes(f.type)) return false;

				if (filterText && filterText !== '') {
					if (filterText.includes(":")) {
						let sp = filterText.split(":");
						if (sp?.length === 2) {
							if (sp[0] === 'trait') {
								sp = sp[1].split(",");

								let trait_any = false;
								let trait_none = false;

								sp = sp.filter(f => {
									if (f === 'any') {
										trait_any = true;
									}
									else if (f === 'none') {
										trait_none = true;
									}
									else {
										return true;
									}
									return false;
								});

								if (trait_any) {
									if (!f.traits_requirement?.length) return false;
								}
								else if (trait_none) {
									if (!!f.traits_requirement?.length) return false;
								}
								else {
									if (sp?.length) {
										if (!f.traits_requirement?.some(g => sp.some(s => s === g))) return false;
									}
								}
							}
							else if (sp[0] === 'skill' && f.bonuses) {
								let bmap = getItemBonuses(f as EquipmentItem);
								if (bmap?.bonuses) {
									sp = sp[1].split(",");
									if (!Object.keys(bmap?.bonuses).some(sk => sp.some(b => b.toLowerCase() === skillToShort(sk)?.toLowerCase()))) return false;
								}
							}
						}
					}
					else {
						textPass = f.name?.toLowerCase().includes(filterText) ||
							f.short_name?.toLowerCase().includes(filterText) ||
							f.flavor?.toLowerCase().includes(filterText) ||
							CONFIG.RARITIES[f.rarity].name.toLowerCase().includes(filterText) ||
							CONFIG.REWARDS_ITEM_TYPE[f.type].toLowerCase().includes(filterText);
					}
				}

				if (!!rarity?.length) {
					rarePass = rarity?.some(r => f.rarity == r);
				}
				if (!!itemType?.length) {
					itemPass = itemType?.some(t => f.type == t);
				}

				if (!ignoreCrewSelection && !!crewMode && !!crewSelection?.length && typeof crewSelection === 'string') {
					let selCrew = this.context.core.crew.find(crew => crew.symbol === crewSelection);
					if (selCrew) {
						if (f.type === 14) {
							if (!!f.max_rarity_requirement && f.max_rarity_requirement < selCrew.max_rarity) return false;
							if (f.traits_requirement?.length) {
								if (f.traits_requirement_operator === 'and') {
									if (!(f.traits_requirement?.every((t) => selCrew?.traits.includes(t) || selCrew?.traits_hidden.includes(t)))) return false;
								}
								else {
									if (!(f.traits_requirement?.some((t) => selCrew?.traits.includes(t) || selCrew?.traits_hidden.includes(t)))) return false;
								}
							}
							let bonuses = getItemBonuses(f as EquipmentItem)?.bonuses;
							if (bonuses) crewPass = Object.keys(bonuses).some(skill => !!selCrew && skill in selCrew.base_skills);

						}
						else {
							crewPass = false;
						}
					}
				}

				return textPass && rarePass && itemPass && crewPass;
			});
		}

		return data;
	}


	renderBuffs(item: EquipmentItem | EquipmentCommon) {
		const { bonuses } = getItemBonuses(item as EquipmentItem);
		return renderBonuses(bonuses, "1em", "0.25em");
	}

	createFlavor(item: EquipmentItem | EquipmentCommon) {
		let output = [] as JSX.Element[];

		let flavor = item.flavor ?? "";
		if (flavor.startsWith("Equippable by: ")) {
			let crew = flavor.replace("Equippable by: ", "").split(", ")?.map(s => this.context.core.crew.find(c => c.symbol === s)).filter(s => !!s) as CrewMember[];
			if (crew?.length) output.push(<div>
				Equippable by: {crew.map((crew) => <Link to={`/crew/${crew.symbol}`}>{crew.name}</Link>).reduce((p, n) => <>{p}, {n}</>)}
			</div>)
		}
		const crew = this.context.core.crew;

		if (item.kwipment && (item.traits_requirement?.length || item.max_rarity_requirement)) {
			let found: CrewMember[] | null = null;

			const bonus = getItemBonuses(item as EquipmentItem);

			found = crew.filter((f) => {
				let mrq = item.max_rarity_requirement ?? f.max_rarity;
				let rr = mrq >= f.max_rarity;

				if (item.traits_requirement?.length) {
					if (item.traits_requirement_operator === "and") {
						rr &&= item.traits_requirement?.every(t => f.traits.includes(t) || f.traits_hidden.includes(t));
					}
					else {
						rr &&= item.traits_requirement?.some(t => f.traits.includes(t) || f.traits_hidden.includes(t));
					}
				}
				rr &&= Object.keys(bonus.bonuses).some(skill => skill in f.base_skills);

				return rr;

			});

			if (found?.length) {
				flavor ??= "";

				if (flavor?.length) {
					flavor += "\n";
				}
				if (found.length > 5) {
					if (item.traits_requirement?.length) {
						if (item.max_rarity_requirement) {
							output.push(<div>
								Equippable by up to <span style={{
									color: CONFIG.RARITIES[item.max_rarity_requirement].color,
									fontWeight: 'bold'
								}}>
									{CONFIG.RARITIES[item.max_rarity_requirement].name}
								</span>
								&nbsp;crew with the following traits: {printRequiredTraits(item)}
							</div>)
							flavor += `Equippable by up to ${CONFIG.RARITIES[item.max_rarity_requirement].name} crew with the following traits: ${printRequiredTraits(item)}`;
						}
						else {
							output.push(<>
								Equippable by crew with the following traits:&nbsp;{printRequiredTraits(item)}
							</>)
							flavor += `Equippable by crew with the following traits: ${printRequiredTraits(item)}`;
						}
					}
					else if (item.max_rarity_requirement) {
						output.push(<div>
							Equippable by up to&nbsp;<span style={{
								color: CONFIG.RARITIES[item.max_rarity_requirement].color,
								fontWeight: 'bold'
							}}>
								{CONFIG.RARITIES[item.max_rarity_requirement].name}
							</span>
							&nbsp;crew.
						</div>)
						flavor += `Equippable by up to ${CONFIG.RARITIES[item.max_rarity_requirement].name} crew.`;
					}
					else {
						output.push(<div>Equippable by&nbsp;{found.length} crew.</div>)
						flavor += `Equippable by ${found.length} crew.`;
					}
				} else {
					output.push(<div>
						Equippable by:&nbsp;{found.map((crew) => <Link to={`/crew/${crew.symbol}`}>{crew.name}</Link>).reduce((p, n) => <>{p}, {n}</>)}
					</div>)

					flavor += 'Equippable by: ' + [...found.map(f => f.symbol)].join(', ');
				}
			}
		}
		return output;
	}

	render() {
		const { ownedQuipment, skills, traits: pftraits, crewType, crewSelection, addNeeded, column, direction, pagination_rows, pagination_page } = this.state;
		let data = [...this.state.data ?? []];

		const filterText = this.state.searchOpts?.filterText?.toLocaleLowerCase();
		const { crewTargetGroup, itemTargetGroup, types, crewMode, buffs, customFields } = this.props;

		const { rarity, itemType } = this.state.searchOpts ?? {};
		const { playerData } = this.context.player;

		let bReady: boolean = !!data?.length;
		let traits = pftraits;
		if (!traits?.length && filterText?.includes("trait:")) {
			let sp = filterText.split(":");
			traits = sp[1].split(",");
		}
		const skillmap = ['CMD', 'SCI', 'SEC', 'DIP', 'ENG', 'MED'].map(r => {
			return {
				key: r.toLowerCase(),
				value: r.toLowerCase(),
				text: appelate(shortToSkill(r) ?? '')
			}
		})

		if (playerData) {
			if (!playerData.calculatedDemands && !this.props.noWorker) {
				bReady = false;
			}
		}

		const { flavor, hideOwnedInfo, hideSearch } = this.props;

		let totalPages = 0;
		let traitFilterOpts = [] as DropdownItemProps[];

		if (buffs) {
			traitFilterOpts.push({
				key: 'any',
				value: 'any',
				text: 'Any Trait-Limited Quipment'
			});

			traitFilterOpts.push({
				key: 'none',
				value: 'none',
				text: 'Any Non-Trait-Limited Quipment'
			});

			traitFilterOpts = traitFilterOpts.concat([...new Set(data.map(d => d.traits_requirement?.sort() ?? []).flat())]?.map(trait => {
				return {
					key: trait,
					value: trait,
					text: appelate(trait)
				}
			}));
		}

		const presentTypes = [...new Set(data?.filter((d) => !types?.length || types.includes(d.type)).map(d => d.type) ?? Object.keys(CONFIG.REWARDS_ITEM_TYPE).map(k => Number.parseInt(k)))];
		const crewTypes = [{
			key: 'all',
			value: 'all',
			text: 'All Crew'
		}];
		if (!!playerData) {
			crewTypes.push({
				key: 'quippable',
				value: 'quippable',
				text: 'Quippable Crew'
			});
			crewTypes.push({
				key: 'owned',
				value: 'owned',
				text: 'Immortalized Crew'
			});
			crewTypes.push({
				key: 'frozen',
				value: 'frozen',
				text: 'Frozen Crew'
			});
		}
		if (bReady) {
			data = this._getFilteredItems();
			totalPages = Math.ceil(data.length / this.state.pagination_rows);

			// Pagination
			data = data.slice(pagination_rows * (pagination_page - 1), pagination_rows * pagination_page);
		}

		const rewardFilterOpts = [] as DropdownItemProps[];
		const ownedOpts = [
			{
				key: 'all',
				value: 'all',
				text: 'All Quipment'
			},
			{
				key: 'owned',
				value: 'owned',
				text: 'Owned Only'
			},
			{
				key: 'buildable',
				value: 'buildable',
				text: 'Buildable Only'
			},
			{
				key: 'both',
				value: 'both',
				text: 'Owned or Buildable'
			}
		] as DropdownItemProps[];

		const rarities = [] as DropdownItemProps[];
		presentTypes.sort((a, b) => {
			let atext = CONFIG.REWARDS_ITEM_TYPE[a];
			let btext = CONFIG.REWARDS_ITEM_TYPE[b];
			return atext.localeCompare(btext);
		});

		presentTypes.forEach((rk) => {
			rewardFilterOpts.push({
				key: rk,
				value: rk,
				text: CONFIG.REWARDS_ITEM_TYPE[rk]
			});
		});

		Object.keys(CONFIG.RARITIES).forEach((rk) => {
			rarities.push({
				key: Number.parseInt(rk),
				value: Number.parseInt(rk),
				text: CONFIG.RARITIES[rk].name
			});
		});

		const crewChoices = this.makeCrewChoices();
		const selCrew = (!!crewMode && !!crewSelection) ? this.makeTrialCrew((this.findFirstCrew(crewSelection) ?? this.context.core.crew.find(f => f.symbol === crewSelection)) as PlayerCrew) : undefined;

		if (this.props.noRender) return <></>

		const isMobile = typeof window !== 'undefined' && window.innerWidth < DEFAULT_MOBILE_WIDTH;

		return (
			<div style={{ margin: 0, padding: 0 }}>
				{!hideSearch &&<div className='ui segment'
					style={{
						display: "flex",
						flexDirection: isMobile ? "column" : "row",
						justifyContent: "space-between",
						alignItems: "center"
					}}>

					{!hideSearch &&
						<div style={{
							display: "flex",
							height: "3em",
							flexDirection: isMobile ? "column" : "row",
							justifyContent: "flex-start",
							alignItems: "center",
							marginLeft: "0.25em"
						}}>

							{!!crewMode &&
								<>
									<div style={{ marginRight: "0.75em" }}>
										<Dropdown 
											search 
											selection
											clearable
											placeholder={"Search for a crew member..."}
											labeled
											options={crewChoices}
											value={crewSelection}
											onChange={(e, { value }) => this.setCrewSelection(value as string)}
										/>
									</div>
									<div style={{ marginLeft: "0.5em", marginRight: "0.5em" }}>
										<Dropdown
											placeholder={"Filter by owned status"}
											options={crewTypes}
											value={crewType}
											onChange={(e, { value }) => this.setCrewType(value as CrewType)}
										/>
									</div>
								</>
							}
							<Input
								style={{ width: "22em" }}
								label={"Search Items"}
								value={filterText}
								onChange={(e, { value }) => this._handleFilter(value as string)}
							/>
							<i className='delete icon'
								title={"Clear Searches and Comparison Marks"}
								style={{
									cursor: "pointer",
									marginLeft: "0.75em"
								}}
								onClick={(e) => {
									this._handleFilter(undefined);
								}
								}
							/>
							{!buffs && <div style={{ marginLeft: "0.5em" }}>
								<Dropdown
									placeholder={"Filter by item type"}
									multiple
									clearable
									scrolling
									options={rewardFilterOpts}
									value={itemType}
									onChange={(e, { value }) => this._handleItemType(value as number[] | undefined)}
								/>
							</div>}
							{!buffs && <div style={{ marginLeft: "0.5em" }}>
								<Dropdown
									placeholder={"Filter by rarity"}
									multiple
									clearable
									options={rarities}
									value={rarity}
									onChange={(e, { value }) => this._handleRarity(value as number[] | undefined)}
								/>
							</div>}
							{buffs && <div style={{ marginLeft: "0.5em" }}>
								<Dropdown
									placeholder={"Filter by trait"}
									multiple
									clearable
									scrolling
									options={traitFilterOpts}
									value={traits}
									onChange={(e, { value }) => this._handleTraits(value as string[] | undefined)}
								/>
							</div>}
							{buffs && <div style={{ marginLeft: "0.5em" }}>
								<Dropdown
									placeholder={"Filter by skill"}
									multiple
									clearable
									scrolling
									options={skillmap}
									value={skills}
									onChange={(e, { value }) => this._handleSkills(value as string[] | undefined)}
								/>
							</div>}
							{buffs && <div style={{ marginLeft: "0.5em" }}>
								<Dropdown
									placeholder={"Owned status"}
									scrolling
									options={ownedOpts}
									value={ownedQuipment}
									onChange={(e, { value }) => this._handleOwned(value as OwnedType)}
								/>
							</div>}
						</div>}

					{!hideOwnedInfo && <div style={{ display: 'flex', flexDirection: 'row', justifyItems: 'flex-end', alignItems: 'center' }}>
						<Checkbox checked={addNeeded} onChange={(e, { value }) => this._handleAddNeeded(!addNeeded)} /><span style={{ marginLeft: "0.5em", cursor: "pointer" }} onClick={(e) => this._handleAddNeeded(!addNeeded)}>Show Unowned Needed Items</span>
					</div>}
				</div>}
				{(!data || !bReady) && <div className='ui medium centered text active inline loader'>{"Calculating crew demands..."}</div>}

				{!!selCrew &&
					<div
						className='ui segment'
						style={{
							backgroundColor: "#333",
							display: "flex",
							justifyContent: "stretch",
							alignItems: "center",
							gap: "1em",
							flexDirection: "column"
						}}>
						<CrewPresenter selfRender quipmentMode hideStats compact plugins={[]} crew={selCrew} hover={false} storeName='items_quip' />
						<CrewItemsView targetGroup={'profile_items'} itemSize={48} crew={selCrew} quipment />						
						<Checkbox label={'Assume Max Slots'} checked={!!this.state.ignoreLimit} onChange={(e, { checked }) => this.setState({ ...this.state, ignoreLimit: !!checked })} />
					</div>
				}

				{bReady && !!(data?.length) && <Table sortable celled selectable striped collapsing unstackable compact="very">
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell
								width={3}
								sorted={column === 'name' ? direction ?? undefined : undefined}
								onClick={() => this._handleSort('name')}
							>
								Item
							</Table.HeaderCell>
							{!hideOwnedInfo && <Table.HeaderCell
								width={1}
								sorted={column === 'quantity' ? direction ?? undefined : undefined}
								onClick={() => this._handleSort('quantity')}
							>
								Quantity
							</Table.HeaderCell>}
							{!hideOwnedInfo &&
								<Table.HeaderCell
									width={1}
									sorted={column === 'needed' ? direction ?? undefined : undefined}
									onClick={() => this._handleSort('needed')}
								>
									Needed
								</Table.HeaderCell>}
							{!types?.length && <Table.HeaderCell
								width={1}
								sorted={column === 'type' ? direction ?? undefined : undefined}
								onClick={() => this._handleSort('type')}
							>
								Item type
							</Table.HeaderCell>}
							<Table.HeaderCell
								width={1}
								sorted={column === 'rarity' ? direction ?? undefined : undefined}
								onClick={() => this._handleSort('rarity')}
							>
								Rarity
							</Table.HeaderCell>
							{!!buffs &&
								<Table.HeaderCell
									width={2}
									sorted={column === 'buffs' ? direction ?? undefined : undefined}
									onClick={() => this._handleSort('buffs')}
								>
									Item Buffs
								</Table.HeaderCell>}
							{!!flavor &&
								<Table.HeaderCell
									width={2}
									sorted={column === 'flavor' ? direction ?? undefined : undefined}
									onClick={() => this._handleSort('flavor')}
								>
									Flavor
								</Table.HeaderCell>}
							{!hideOwnedInfo &&
								<Table.HeaderCell
									width={1}
									sorted={column === 'factionOnly' ? direction ?? undefined : undefined}
									onClick={() => this._handleSort('factionOnly')}
								>
									Faction Only
								</Table.HeaderCell>}
							{!!customFields?.length &&
								customFields.map((field) => (
									<Table.HeaderCell
										key={'custom_' + field.field + "_header"}
										width={field.width ?? 1}
										sorted={column === field.field ? direction ?? undefined : undefined}
										onClick={() => this._handleSort(field.field)}
									>
										{field.text}
									</Table.HeaderCell>
								))}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{data.map((item, idx) => (
							<Table.Row key={idx}>
								<Table.Cell>
									<div
										title={item.name + (!hideOwnedInfo ? (!item.quantity ? ' (Unowned)' : ` (${item.quantity})`) : "")}
										style={{
											display: 'grid',
											gridTemplateColumns: !!selCrew ? '87px auto' : '60px auto',
											gridTemplateAreas: `'icon stats' 'icon description'`,
											gridGap: '1px'
										}}
									>
										<div style={{ gridArea: 'icon', display: 'flex', gap: "0.5em", width: "87px", flexDirection: 'row', alignItems: 'center' }}>
											{!!selCrew &&
												<Checkbox
													disabled={this.maxTrial(selCrew as PlayerCrew) && !this.getTrial(selCrew.symbol, Number.parseInt(item.kwipment_id?.toString() ?? '0'))}
													checked={this.getTrial(selCrew.symbol, Number.parseInt(item.kwipment_id?.toString() ?? '0'))}
													onChange={(e, { checked }) => this.setTrial(selCrew.symbol, Number.parseInt(item.kwipment_id?.toString() ?? '0'), checked || false)}
												/>
											}

											<ItemDisplay
												targetGroup={itemTargetGroup ?? 'profile_items'}
												style={{
													opacity: !item.quantity && !hideOwnedInfo ? '0.20' : '1'
												}}
												playerData={this.context.player.playerData}
												itemSymbol={item.symbol}
												allItems={this.state.data}
												rarity={item.rarity}
												maxRarity={item.rarity}
												size={48}
												src={`${process.env.GATSBY_ASSETS_URL}${item.imageUrl}`} />

										</div>
										<div style={{ gridArea: 'stats', cursor: "pointer" }}>
											<a onClick={(e) => this._handleNavigate(item.symbol)}>
												<span style={{ fontWeight: 'bolder', fontSize: '1.25em' }}>
													{item.rarity > 0 && (
														<span>
															{item.rarity} <Icon name="star" />{' '}
														</span>
													)}
													{item.name}
												</span>
											</a>
										</div>
										<div style={{ gridArea: 'description' }}>{this.createFlavor(item)}</div>
									</div>
								</Table.Cell>
								{!hideOwnedInfo && <Table.Cell>{item.quantity}</Table.Cell>}
								{!hideOwnedInfo && <Table.Cell>{item.needed ?? 'N/A'}</Table.Cell>}
								{!types?.length && <Table.Cell>{CONFIG.REWARDS_ITEM_TYPE[item.type]}</Table.Cell>}
								<Table.Cell>{CONFIG.RARITIES[item.rarity].name}</Table.Cell>
								{!!buffs && <Table.Cell>{this.renderBuffs(item)}</Table.Cell>}
								{!!flavor && <Table.Cell>{this.createFlavor(item)}</Table.Cell>}
								{!hideOwnedInfo && <Table.Cell>{item.factionOnly === undefined ? '' : (item.factionOnly === true ? 'Yes' : 'No')}</Table.Cell>}
								{!!customFields?.length &&
									customFields.map((field) => (
										<Table.Cell key={'custom_' + field.field + "_value"}>
											{field.format ? field.format(item[field.field]) : item[field.field]}
										</Table.Cell>
									))}
							</Table.Row>
						))}
					</Table.Body>
					<Table.Footer>
						<Table.Row>
							<Table.HeaderCell colSpan="8">
								<Pagination
									totalPages={totalPages}
									activePage={pagination_page}
									onPageChange={(event, { activePage }) => this._onChangePage(activePage)}
								/>
								<span style={{ paddingLeft: '2em' }}>
									Items per page:{' '}
									<Dropdown
										inline
										options={pagingOptions}
										value={pagination_rows}
										onChange={(event, { value }) => this.setRows(value as number)}
									/>
								</span>
							</Table.HeaderCell>
						</Table.Row>
					</Table.Footer>
				</Table>}
				
				{!itemTargetGroup && 
					<ItemHoverStat targetGroup='profile_items' navigate={this._handleNavigate} />}

				{!crewTargetGroup && <CrewHoverStat targetGroup='profile_items_crew' />}
				<br />
				{!hideOwnedInfo && !!(data?.length) && bReady &&
					<div style={{
						display: "flex",
						flexDirection: "row",
						justifyContent: "flex-start"
					}}>
						<div
							className='ui button'
							onClick={(e) => { if (this.state.data) this._exportItems(this.state.data) }}
							style={{ display: 'inline', flexDirection: 'row', justifyContent: 'space-evenly', cursor: 'pointer' }}
						>
							<span style={{ margin: '0 2em 0 0' }}>Export to CSV</span><i className='download icon' />
						</div>
						<div
							className='ui button'
							onClick={(e) => { if (this.state.data) this._exportItems(this.state.data, true) }}
							style={{ marginRight: "2em", display: 'inline', flexDirection: 'row', justifyContent: 'space-evenly', cursor: 'pointer' }}
						>
							<span style={{ margin: '0 2em 0 0' }}>Copy to Clipboard</span><i className='clipboard icon' />
						</div>
					</div>}
			</div>
		);
	}

	_exportItems(data: (EquipmentCommon | EquipmentItem)[], clipboard?: boolean) {
		const { playerData } = this.context.player;

		let text = exportItemsAlt(data);
		if (clipboard) {
			navigator.clipboard.writeText(text);
			return;
		}
		downloadData(`data:text/csv;charset=utf-8,${encodeURIComponent(text)}`, 'items.csv');
	}
}

export default ProfileItems;
