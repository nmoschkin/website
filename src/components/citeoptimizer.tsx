import React from 'react';
import { Dropdown, Grid, Table, Icon, Rating, Popup, Pagination, Segment, Tab, Label, Accordion, Checkbox, Input } from 'semantic-ui-react';
import { Link } from 'gatsby';
import { calculateBuffConfig } from '../utils/voyageutils';

import '../typings/worker';
import UnifiedWorker from 'worker-loader!../workers/unifiedWorker';

import { StatLabelProps } from '../components/statlabel';
import { getSkillOrder, navToCrewPage, printPortalStatus } from '../utils/crewutils';
import { CrewMember } from '../model/crew';
import { CiteEngine, CiteMode, PlayerCrew } from '../model/player';
import { gradeToColor } from '../utils/crewutils';
import { CrewHoverStat, CrewTarget } from './hovering/crewhoverstat';
import { GlobalContext } from '../context/globalcontext';
import { PortalFilter, RarityFilter } from './crewtables/commonoptions';
import { appelate } from '../utils/misc';
import ItemDisplay from './itemdisplay';
import { DEFAULT_MOBILE_WIDTH } from './hovering/hoverstat';
import { TinyStore } from '../utils/tiny';

const pagingOptions = [
	{ key: '0', value: '10', text: '10' },
	{ key: '1', value: '25', text: '25' },
	{ key: '2', value: '50', text: '50' },
	{ key: '3', value: '100', text: '100' }
];

type CiteOptimizerProps = {
};

export interface VoyageImprovement {
	voyage: string;
	crew: PlayerCrew[];
	maxEV: number;
	remainingEV: number;
}

export interface CiteData {
	crewToCite: PlayerCrew[];
	crewToTrain: PlayerCrew[];
}
interface SymCheck { symbol: string, checked: boolean };
type CiteOptimizerState = {
	citePage: number;
	trainingPage: number;
	paginationRows: number;
	citeData: CiteData | undefined | null;
	currentCrew: CrewMember | null | undefined;
	touchCrew: CrewMember | null | undefined;
	touchToggled: boolean;
	citeMode?: CiteMode;
	sort?: string;
	direction?: 'ascending' | 'descending';
	checks?: SymCheck[];
};

export class StatLabel extends React.Component<StatLabelProps> {
	render() {
		const { title, value } = this.props;

		return (
			<Label size="small" style={{ marginBottom: '0.5em', width: "12em" }}>
				{title}
				<Label.Detail>{value}</Label.Detail>
			</Label>
		);
	}
}
class CiteOptimizer extends React.Component<CiteOptimizerProps, CiteOptimizerState> {
	static contextType = GlobalContext;
	context!: React.ContextType<typeof GlobalContext>;
	private lastCiteMode: CiteMode | undefined = undefined;
	private tiny = TinyStore.getStore('citeOptimizer');

	constructor(props: CiteOptimizerProps) {
		super(props);

		this.state = {
			citePage: 1,
			trainingPage: 1,
			paginationRows: 20,
			citeData: undefined,
			currentCrew: undefined,
			touchCrew: undefined,
			touchToggled: false,
			citeMode: {
				rarities: [],
				engine: this.tiny.getValue<CiteEngine>('engine', "original") ?? "original"
			}
		};
	}

	componentDidMount() {
		const { citeMode } = this.state;
		this.runWorker(citeMode);
	}

	componentDidUpdate(prevProps: Readonly<CiteOptimizerProps>, prevState: Readonly<CiteOptimizerState>, snapshot?: any): void {
		if (JSON.stringify(this.state.citeMode ?? {}) !== JSON.stringify(this.lastCiteMode ?? {})) {
			this.lastCiteMode = this.state.citeMode;
			this.runWorker(this.lastCiteMode);
		}
	}

	readonly setEngine = (engine: CiteEngine) => {
		if (this.state.citeMode?.engine !== engine) {
			this.tiny.setValue('engine', engine, true);
			this.setState({ ... this.state, citeMode: { ... this.state.citeMode, engine: engine }, citeData: null });
		}
	}

	readonly setChecked = (crew: PlayerCrew | string, value?: boolean) => {
		const fpros = this.state.checks ?? [] as SymCheck[];
		let fi: SymCheck | null = null;

		if (typeof crew === 'string') {
			fi = fpros.find(z => z.symbol === crew) ?? null;
		}
		else {
			fi = fpros.find(z => z.symbol === crew.symbol) ?? null;
		}

		if (fi) {
			fi.checked = value ?? false;
		}
		else if (value) {
			fi = {
				symbol: typeof crew === 'string' ? crew : crew.symbol,
				checked: value
			}
			fpros.push(fi);
		}

		this.setState({ ... this.state, checks: fpros });
	}

	readonly getChecked = (crew: PlayerCrew | string) => {
		const fpros = this.state.checks ?? [] as SymCheck[];
		let fi: SymCheck | null = null;

		if (typeof crew === 'string') {
			fi = fpros.find(z => z.symbol === crew) ?? null;
		}
		else {
			fi = fpros.find(z => z.symbol === crew.symbol) ?? null;
		}

		return fi?.checked ?? false;
	}

	private runWorker(citeMode?: CiteMode) {
		const worker = new UnifiedWorker();
		const { playerData, buffConfig } = this.context.player;
		const allCrew = this.context.core.crew;

		const engine = this.state.citeMode?.engine ?? "original";
		if (playerData) playerData.citeMode = citeMode;

		worker.addEventListener('message', (message: { data: { result: any; }; }) => this.setState({ citeData: message.data.result }));

		const workerName = engine === 'original' ? 'citeOptimizer' : 'ironywrit';

		worker.postMessage({
			worker: workerName,
			playerData,
			allCrew,
			buffs: buffConfig
		});
	}

	cc = false;

	private createStateAccessors<T>(name): [T, (value: T) => void] { return [
		this.state[name],
		(value: T) => this.setState((prevState) => { prevState[name] = value; return prevState; })
	] };

	renderVoyageGroups(data: CiteData, confine?: string[]) {
		const voyages = [] as VoyageImprovement[];
		let currVoy: string = '';
		const { playerData } = this.context.player;

		const voyageData = this.context.player.ephemeral;
		const [citeMode, setCiteMode] = this.createStateAccessors<CiteMode>('citeMode');

		if (voyageData?.voyage?.length) {
			let v = voyageData.voyage[0];
			let sk = [v.skills.primary_skill, v.skills.secondary_skill].map((t) => t.replace("_skill", "")).reduce((prev, curr) => prev + "/" + curr);
			if (sk) currVoy = appelate(sk);
		}

		const currentVoyage = currVoy;

		[data.crewToCite, data.crewToTrain].forEach((dataSet) => {
			for (let voycrew of dataSet) {
				const findcrew = playerData?.player.character.crew.find((c) => c.name === voycrew.name);

				if (!findcrew) continue;

				if (this.state.checks?.some(c => c.checked) && !this.state.checks?.some(c => c.checked && c.symbol === findcrew?.symbol)) {
					continue;
				}

				const crew = JSON.parse(JSON.stringify(findcrew), (key, value) => {
					if (key.includes("data")) {
						try {
							let v = new Date(value);
							return v;
						}
						catch {
							return value;
						}
					}
					return value;
				});

				crew.voyagesImproved = voycrew.voyagesImproved;
				crew.evPerCitation = voycrew.evPerCitation;
				crew.addedEV = voycrew.addedEV;
				crew.totalEVContribution = voycrew.totalEVContribution;
				crew.totalEVRemaining = voycrew.totalEVRemaining;
				crew.pickerId = voycrew.pickerId;

				for (let voyage of crew.voyagesImproved ?? []) {
					if (!!(confine?.length) && !confine.includes(voyage)) continue;

					let vname = appelate(voyage);
					let currvoy = voyages.find((v) => v.voyage === vname);

					if (!currvoy){
						currvoy = { voyage: vname, crew: [], maxEV: 0, remainingEV: 0 };
						voyages.push(currvoy);
					}

					let test = currvoy.crew.find((c) => c.name === crew.name);

					if (!test) {
						currvoy.crew.push(crew);
					}
				}
			}
		});

		voyages.sort((a, b) => {

			let ma = Math.max(...a.crew.map(ac => ac.totalEVContribution ?? 0));
			let mb = Math.max(...b.crew.map(bc => bc.totalEVContribution ?? 0));

			if (!a.maxEV) a.maxEV = ma;
			if (!b.maxEV) b.maxEV = mb;

			let ra = Math.min(...a.crew.map(ac => ac.totalEVRemaining ?? 0));
			let rb = Math.min(...b.crew.map(bc => bc.totalEVRemaining ?? 0));

			if (!a.remainingEV) a.remainingEV = ra;
			if (!b.remainingEV) b.remainingEV = rb;

			if (a.voyage === currentVoyage) return -1;
			else if (b.voyage === currentVoyage) return 1;

			let r = mb - ma;

			if (r) return r;

			r = ra - rb;

			if (r) return r;

			ma = a.crew.map(ac => ac.pickerId ?? 0).reduce((prev, curr) => prev + curr);
			mb = b.crew.map(bc => bc.pickerId ?? 0).reduce((prev, curr) => prev + curr);

			r = ma - mb;

			if (r) return r;

			r = b.crew.length - a.crew.length;
			if (!r) r = a.voyage.localeCompare(b.voyage);

			return r;
		});

		voyages.forEach((voyage) => {
			voyage.crew.sort((a, b) => {
				if (a.totalEVContribution !== undefined && b.totalEVContribution !== undefined) {
					return b.totalEVContribution - b.totalEVContribution;
				}
				else if (a.pickerId !== undefined && b.pickerId !== undefined) {
					return a.pickerId - b.pickerId;
				}
				else {
					return a.name.localeCompare(b.name);
				}

			})
		})

		return (<div style={{
			display: "flex",
			flexDirection: "column",
			justifyContent: "stretch"
		}}>
			<Table striped>
				{voyages.map((voyage, idx) => {

					let sp = voyage.voyage.split("/");
					if (citeMode?.priSkills?.length) {
						if (!citeMode.priSkills.includes(sp[0])) return (<></>);
					}
					if (citeMode?.secSkills?.length) {
						if (!citeMode.secSkills.includes(sp[1])) return (<></>);
					}


					return (<Table.Row key={"voy" + idx}>
						<Table.Cell style={{backgroundColor: voyage.voyage === currentVoyage ? 'green' : undefined,}}>
							<div style={{
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								alignItems: "center",
								height: "100%",
								margin: "1em"
							}}>
							{voyage.voyage === currentVoyage && <h3 style={{marginBottom:0}}><u>Current Voyage</u></h3>}
							<h2 style={{marginBottom: 0}}>{voyage.voyage}</h2>
							<i style={{margin:0}}>(Max Final EV: <b>+{Math.ceil(voyage.maxEV)})</b></i>
							<i style={{margin:0}}>(Min Remaining EV: <b>+{Math.ceil(voyage.remainingEV)})</b></i>
							</div>
						</Table.Cell>
						<Table.Cell>

						<Grid doubling columns={3} textAlign='center'>
								{voyage.crew.map((crew) => (
									<div style={{margin: "1.5em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
									<ItemDisplay
										size={64}
										src={`${process.env.GATSBY_ASSETS_URL}${crew.imageUrlPortrait}`}
										rarity={crew.rarity}
										maxRarity={crew.max_rarity}
										targetGroup='citationTarget'
										itemSymbol={crew.symbol}
										allCrew={this.context.core.crew}
										playerData={this.context.player.playerData}
										/>
										<b onClick={(e) => setCiteMode({ ... citeMode ?? {}, nameFilter: crew.name })}
											style={{
											cursor: "pointer",
											margin:"0.5em 0 0 0",
											textDecoration: "underline"
											}}
											title={"Click to see only this crew member"}
											>
												{crew.name} ({crew.pickerId})
										</b>
										<i style={{margin:"0"}} >
											<span
											title={"Click to see only voyages involving this crew member"}
											style={{cursor: "pointer", margin:"0", textDecoration: "underline"}}
											 onClick={(e) => setCiteMode({ ... citeMode ?? {}, nameFilter: "voyage:" + crew.name })}
											>{crew.voyagesImproved?.length} Voyages Improved, </span>
											{Math.ceil(crew.totalEVContribution ?? 0)} Total EV
										</i>
									</div>
								))}
							</Grid>
						</Table.Cell>
					</Table.Row>)
					}
				)}

			</Table>
		</div>)

	}

	renderTable(data?: PlayerCrew[], tabName?: string, training = true) {
		if (!data || !this.context.player.playerData) return <></>;
		const [paginationPage, setPaginationPage] = this.createStateAccessors<number>(training ? 'trainingPage' : 'citePage');
		const [otherPaginationPage, setOtherPaginationPage] = this.createStateAccessors<number>(training ? 'citePage' : 'trainingPage');
		const [paginationRows, setPaginationRows] = this.createStateAccessors<number>('paginationRows');
		const [currentCrew, setCurrentCrew] = this.createStateAccessors<(PlayerCrew | CrewMember | null | undefined)>('currentCrew');
		const engine = this.state.citeMode?.engine ?? 'original';

		const baseRow = (paginationPage - 1) * paginationRows;
		const totalPages = Math.ceil(data.length / paginationRows);
		const buffConfig = calculateBuffConfig(this.context.player.playerData.player);
		tabName ??= "";
		const imageClick = (e: React.MouseEvent<HTMLImageElement, MouseEvent>, data: any) => {
			console.log("imageClick");
			// if (matchMedia('(hover: hover)').matches) {
			// 	window.location.href = "/crew/" + data.symbol;
			// }
		}

		return (<div style={{overflowX: "auto"}}>
			<Table sortable celled selectable striped collapsing unstackable compact="very">
				<Table.Header>
					<Table.Row>
						<Table.HeaderCell>Rank</Table.HeaderCell>
						<Table.HeaderCell>Crew</Table.HeaderCell>
						<Table.HeaderCell>Rarity</Table.HeaderCell>
						<Table.HeaderCell>Final EV</Table.HeaderCell>
						{!training &&
						<React.Fragment>
							<Table.HeaderCell>Remaining EV</Table.HeaderCell>
							<Table.HeaderCell>EV Per Citation</Table.HeaderCell>
						</React.Fragment>
						}
						<Table.HeaderCell>Voyages<br />Improved</Table.HeaderCell>
						{engine === 'beta_tachyon_pulse' &&
							<React.Fragment>
							<Table.HeaderCell>Antimatter<br />Traits</Table.HeaderCell>
							<Table.HeaderCell>Skill Order</Table.HeaderCell>
							</React.Fragment>
							}
						<Table.HeaderCell>In Portal</Table.HeaderCell>
						<Table.HeaderCell>Compare</Table.HeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{data.slice(baseRow, baseRow + paginationRows).map((row, idx: number) => {
						const crew = this.context.player.playerData?.player.character.crew.find(c => c.name == row.name);

						return (crew &&
							<Table.Row key={crew.symbol + idx + tabName} positive={this.getChecked(crew.symbol)}>

								<Table.Cell>{row.pickerId}</Table.Cell>
								<Table.Cell>
									<div
										style={{
											display: 'grid',
											gridTemplateColumns: '60px auto',
											gridTemplateAreas: `'icon stats' 'icon description'`,
											gridGap: '1px'
										}}>
										<div style={{ gridArea: 'icon' }}

										>
											<CrewTarget targetGroup='citationTarget'
												inputItem={crew}>
												<img
													onClick={(e) => imageClick(e, crew)}
													width={48}
													src={`${process.env.GATSBY_ASSETS_URL}${crew.imageUrlPortrait}`}
													/>
											</CrewTarget>
										</div>
										<div style={{ gridArea: 'stats' }}>
											<span style={{ fontWeight: 'bolder', fontSize: '1.25em' }}><Link to={`/crew/${crew.symbol}/`}>{crew.name}</Link></span>
										</div>

									</div>
								</Table.Cell>
								<Table.Cell>
									<Rating icon='star' rating={crew.rarity} maxRating={crew.max_rarity} size='large' disabled />
								</Table.Cell>
								<Table.Cell>
									{Math.ceil(training ? (row.addedEV ?? row.totalEVContribution ?? 0) : (row.totalEVContribution ?? 0))}
								</Table.Cell>
								{
									!training &&
									<React.Fragment>
										<Table.Cell>
											{Math.ceil(row.totalEVRemaining ?? 0)}
										</Table.Cell>
										<Table.Cell>
											{Math.ceil(row.evPerCitation ?? 0)}
										</Table.Cell>
									</React.Fragment>
								}
								<Table.Cell>
									<Popup trigger={<b>{row.voyagesImproved?.length}</b>} content={row.voyagesImproved?.join(', ')} />
								</Table.Cell>
								{engine === 'beta_tachyon_pulse' &&
									<React.Fragment>

										<Table.Cell>{row.amTraits}</Table.Cell>
										<Table.Cell width={2}>
										<div style={{
												display: "flex",
												flexDirection: "row",
												justifyContent: "flex-start",
												alignItems: "left"
											}}>

											<div style={{
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												alignItems: "center"
											}}>
												<div style={{
													display: "flex",
													flexDirection: "row",
													justifyContent: "space-evenly",
													alignItems: "center"
												}}>
												{getSkillOrder(row).map((mskill, idx) => (
												<img
													title={appelate(mskill)}
													key={"skimage"+idx+mskill}
													src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${mskill}.png`}
													style={{
														maxHeight: "1.5em",
														maxWidth: "1.5em",
														margin: "0.5em",
													}}

												/>))}
												</div>

												<i style={{
													fontSize: "0.75em",
													fontWeight: "bold",
													color: gradeToColor(row.scoreTrip ?? 0) ?? 'lightgreen'
													}}>{Math.floor(100 * (row?.scoreTrip ?? 0)) / 10}</i>

											</div>
										</div>
										</Table.Cell>
									</React.Fragment>

									}

								<Table.Cell>
									<span title={printPortalStatus(crew, true, true)}>
									{printPortalStatus(crew, true, true)}
									</span>
								</Table.Cell>
								<Table.Cell>
									<Checkbox checked={this.getChecked(crew.symbol)} onChange={(e, { checked }) => this.setChecked(crew.symbol, checked as boolean)} />
								</Table.Cell>
							</Table.Row>
						);
					})}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.HeaderCell colSpan={engine === 'beta_tachyon_pulse' ? 11 : 9}>
							<Pagination
								totalPages={totalPages}
								activePage={paginationPage}
								onPageChange={(event, { activePage }) => setPaginationPage(activePage as number)}
							/>
							<span style={{ paddingLeft: '2em' }}>
								Rows per page:{' '}
								<Dropdown
									inline
									options={pagingOptions}
									value={paginationRows}
									onChange={(event, { value }) => {
										setPaginationPage(1);
										setOtherPaginationPage(1);
										setPaginationRows(value as number);
									}}
								/>
							</span>
						</Table.HeaderCell>
					</Table.Row>
				</Table.Footer>
			</Table>
			</div>);
	}

	get crew(): CrewMember | undefined {
		return this.state.currentCrew ?? undefined;
	}

	findSkills(crew: PlayerCrew[], secondary?: boolean) {
		let sk = [] as string[];
		for (let cm of crew) {
			if (cm.voyagesImproved?.length) {
				for (let voy of cm.voyagesImproved) {
					let sp = voy.split("/");
					let ns = (appelate(secondary ? sp[1] : sp[0]));
					if (!sk.includes(ns)) {
						sk.push(ns);
					}
				}
			}
		}

		sk.sort();
		return sk;
	}

	render() {
		if (!this.context.player.playerData) return <></>;
		const buffConfig = calculateBuffConfig(this.context.player.playerData.player);
		const [citeMode, setCiteMode] = this.createStateAccessors<CiteMode>('citeMode');
		const { engine } = citeMode;

		const [preFilterData, setCiteData] = this.createStateAccessors<CiteData | undefined>('citeData');

		let compact = true;
		const workset = !preFilterData ? undefined : { ...preFilterData, crewToCite: [ ... preFilterData?.crewToCite ?? [] ], crewToTrain: [ ... preFilterData?.crewToTrain ?? [] ] } as CiteData;

		workset?.crewToCite?.forEach((crew, idex) => crew.pickerId = idex + 1);
		workset?.crewToTrain?.forEach((crew, idex) => crew.pickerId = idex + 1);

		let pri: string[] = [];
		let sec: string[] = [];
		let seat: string[] = [];

		const confine = [] as string[];

		const engOptions = ['original', 'beta_tachyon_pulse'].map(s => {
			return {
				key: s,
				value: s,
				text: appelate(s)
			}
		});

		if (workset) {
			let ac = workset.crewToCite.concat(workset.crewToTrain);
			pri = this.findSkills(ac);
			sec = this.findSkills(ac, true);
			seat = ["command", "diplomacy", "science", "engineering", "security", "medicine"].sort();
		}

		const priSkills = pri.map((sk) =>{
			return {
				key: sk,
				value: sk,
				text: sk
			}
		})

		const secSkills = sec.map((sk) =>{
			return {
				key: sk,
				value: sk,
				text: sk
			}
		})

		const seatSkills = seat.map((sk) =>{
			return {
				key: sk,
				value: sk,
				text: appelate(sk)
			}
		})

		if (workset && citeMode?.priSkills?.length) {
			workset.crewToCite = workset.crewToCite.filter((crew) => crew.voyagesImproved?.some(vi => citeMode.priSkills?.some(ci => vi.startsWith(ci.toLowerCase()))));
			workset.crewToTrain = workset.crewToTrain.filter((crew) => crew.voyagesImproved?.some(vi => citeMode.priSkills?.some(ci => vi.startsWith(ci.toLowerCase()))));
		}

		if (workset && citeMode?.secSkills?.length) {
			workset.crewToCite = workset.crewToCite.filter((crew) => crew.voyagesImproved?.some(vi => citeMode.secSkills?.some(ci => vi.endsWith(ci.toLowerCase()))));
			workset.crewToTrain = workset.crewToTrain.filter((crew) => crew.voyagesImproved?.some(vi => citeMode.secSkills?.some(ci => vi.endsWith(ci.toLowerCase()))));
		}

		if (workset && citeMode?.seatSkills?.length) {
			const { playerData } = this.context.player;

			workset.crewToCite = workset.crewToCite
				.map(crew => {
					let fc = playerData?.player?.character?.crew?.find(fc => fc.name === crew.name);
					if (fc) {
						crew.base_skills = fc.base_skills;
					}
					return crew;
				})
				.filter((crew) => citeMode.seatSkills?.some(sk => (sk.toLowerCase() + "_skill") in crew?.base_skills));

			workset.crewToTrain = workset.crewToTrain
				.map(crew => {
					let fc = playerData?.player?.character?.crew?.find(fc => fc.name === crew.name);
					if (fc) {
						crew.base_skills = fc.base_skills;
					}
					return crew;
				})
				.filter((crew) => citeMode.seatSkills?.some(sk => (sk.toLowerCase() + "_skill") in crew?.base_skills));
		}

		if (workset && citeMode?.portal !== undefined && this.context?.player?.playerData?.player?.character?.crew?.length) {
			workset.crewToCite = workset.crewToCite.filter((crew) => this.context.player.playerData?.player.character.crew.find(c => c.name === crew.name)?.in_portal === citeMode.portal);
			workset.crewToTrain = workset.crewToTrain.filter((crew) => this.context.player.playerData?.player.character.crew.find(c => c.name === crew.name)?.in_portal === citeMode.portal);
		}

		if (workset && citeMode?.nameFilter) {
			if (citeMode.nameFilter.startsWith("voyage:")) {
				const voyscan = citeMode.nameFilter.slice(7).toLowerCase();
				const voycrew = workset.crewToCite.concat(workset.crewToTrain).find(d => d.name.toLowerCase() === voyscan);

				if (voycrew) {
					workset.crewToCite = workset.crewToCite.filter((crew) => crew.voyagesImproved?.some(p => voycrew.voyagesImproved?.includes(p)));
					workset.crewToTrain = workset.crewToTrain.filter((crew) => crew.voyagesImproved?.some(p => voycrew.voyagesImproved?.includes(p)));
					for (let vn of voycrew.voyagesImproved ?? []) {
						confine.push(vn);
					}
				}
				else {
					workset.crewToCite = workset.crewToCite.filter((crew) => crew.name.toLowerCase().includes(voyscan));
					workset.crewToTrain = workset.crewToTrain.filter((crew) => crew.name.toLowerCase().includes(voyscan));
				}
			}
			else {
				workset.crewToCite = workset.crewToCite.filter((crew) => crew.name.toLowerCase().includes(citeMode.nameFilter?.toLowerCase() ?? ""));
				workset.crewToTrain = workset.crewToTrain.filter((crew) => crew.name.toLowerCase().includes(citeMode.nameFilter?.toLowerCase() ?? ""));
			}
		}

		const citeData = workset;
		const compareCount = this.state.checks?.filter(z => z.checked)?.length;
		const narrow = typeof window !== 'undefined' && window.innerWidth < DEFAULT_MOBILE_WIDTH;

		return (
			<>
				<Accordion
					defaultActiveIndex={-1}
					panels={[
						{
							index: 0,
							key: 0,
							title: 'Explainer (Click To Expand)',
							content: {
								content: (
									<div>
										{/* <h3>Explanation</h3> */}
										<p>
											A crew's Expected Value (EV) is the average you can expect a crew to contribute to all voyages. EV Final accounts for the crew fully fused. EV Left, while less important, calculates the difference in contribution between fully fused and their current rank. Voyages Improved is how many of the voyage combinations the crew contributes to. Primary and secondary are taken into account, because CMD/DIP voyage will yield different results than DIP/CMD.
										</p>
										<p>
											A crew's EV for a voyage is found by finding the crew's average for the skill "Base + (Min + Max) / 2", multiplying that by 0.35 if the skill is the primary for the voyage, 0.25 if it is secondary, and 0.1 otherwise. To find how much the crew contributes to the total voyage, we find the best crew for the voyage that are fully leveled and equipped.
										</p>
										<p>
											"Training" is considered simply leveling and equipping the considered crew <u>at their current rarity</u>. This is done by comparing the current total EV of all voyages with those as if the considered crew were fully leveled and equiped <u>at current rarity</u>.
										</p>
										<p>
											"Citing" considered <u>fully fusing</u>, leveling and equipping the considered crew. This is done by comparing the current total EV of all voyages with those as if the considered crew were fully leveled and equiped <u>and fused</u>.
										</p>
									</div>
								)
							}
						}
					]}
				/>
				<Segment>
					<h3>Engine</h3>
					<div style={{
						display: "flex",
						flexDirection: window.innerWidth < DEFAULT_MOBILE_WIDTH ? "column" : "row"
					}}>
						<Dropdown
							multiple={false}
							options={engOptions}
							placeholder={"Select Engine"}
							value={engine}
							onChange={(e, { value }) => {
								this.setEngine(value as CiteEngine);
							}}
							/>

					</div>
				</Segment>
				<Segment>
					<h3>Filters</h3>
					<div style={{
						display: "flex",
						flexDirection: window.innerWidth < DEFAULT_MOBILE_WIDTH ? "column" : "row"
					}}>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "left", margin: 0, marginRight: "1em"}}>
							<RarityFilter
								altTitle='Calculate specific rarity'
								multiple={false}
								rarityFilter={citeMode?.rarities ?? []}
								setRarityFilter={(data) => {
									this.setState({ ...this.state, citeMode: { ... citeMode ?? {}, rarities: data }, citeData: null });
								}}
								/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "left"}}>
							<PortalFilter
								portalFilter={citeMode?.portal}
								setPortalFilter={(data) => {
									setCiteMode({ ... citeMode ?? {}, portal: data });
								}}
								/>
						</div>
						<div style={{ display: "flex", height: "3em", flexDirection: "row", justifyContent: "center", alignItems: "center", marginLeft: "1em"}}>
							<Input

								label={"Search"}
								value={citeMode.nameFilter}
								onChange={(e, { value }) => setCiteMode({ ... citeMode ?? {}, nameFilter: value })}
								/>
							<i className='delete icon'
								title={"Clear Searches and Comparison Marks"}
								style={{
									cursor: "pointer",
									marginLeft: "0.75em"
								}}
								onClick={(e) => {
										setCiteMode({ ... citeMode ?? {}, nameFilter: '' });
										window.setTimeout(() => {
											this.setState({ ...this.state, checks: undefined });
										});

									}
								}
						 	/>

						</div>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "left", marginLeft: "1em"}}>
							<Dropdown
								options={priSkills}
								multiple
								clearable
								placeholder={"Filter by primary skill"}
								value={citeMode.priSkills}
								onChange={(e, { value }) => setCiteMode({ ... citeMode ?? {}, priSkills: value as string[] })}
								/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "left", marginLeft: "1em"}}>
							<Dropdown
								options={secSkills}
								multiple
								clearable
								placeholder={"Filter by secondary skill"}
								value={citeMode.secSkills}
								onChange={(e, { value }) => setCiteMode({ ... citeMode ?? {}, secSkills: value as string[] })}
								/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", alignItems: "left", marginLeft: "1em"}}>
							<Dropdown
								options={seatSkills}
								multiple
								clearable
								placeholder={"Filter by voyage seating"}
								value={citeMode.seatSkills}
								onChange={(e, { value }) => setCiteMode({ ... citeMode ?? {}, seatSkills: value as string[] })}
								/>
						</div>

					</div>
				</Segment>

				<Segment>
					{!citeData &&
						<>
							<Icon loading name='spinner' /> Loading citation optimizer ...
						</>
					}

					{citeData &&
						<>
						<Tab
						 	panes={[
							{ menuItem: narrow ? 'Cite' : 'Crew To Cite', render: () => this.renderTable(citeData?.crewToCite, "cite", false) },
							{ menuItem: narrow ? 'Train' : 'Crew To Train', render: () => this.renderTable(citeData?.crewToTrain, "train", true) },
							{ menuItem: narrow ? 'Groups' : 'Voyage Groups' + (compareCount ? ' (' + compareCount + ')' : '') , render: () => this.renderVoyageGroups(citeData, confine) },
						]} />
						</>
					}
				</Segment>
				<CrewHoverStat openCrew={(crew) => navToCrewPage(crew, this.context.player.playerData?.player.character.crew, buffConfig)}  targetGroup='citationTarget' />

			</>
		);
	}
}

export default CiteOptimizer;