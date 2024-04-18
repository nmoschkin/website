import React from 'react';
import { Form, Dropdown, Segment, Message, Button, Label, Image, Icon } from 'semantic-ui-react';

import { IVoyageCrew } from '../../model/voyage';
import { OptionsBase, OptionsModal, OptionGroup, OptionsModalProps } from '../../components/base/optionsmodal_base';

import { CalculatorContext } from './context';
import CrewPicker from '../../components/crewpicker';
import { IEventScoredCrew } from '../eventplanner/model';
import { computeEventBest, guessCurrentEventId } from '../../utils/events';

interface ISelectOption {
	key: string;
	value: string;
	text: string;
};

type CrewExcluderProps = {
	rosterCrew: IVoyageCrew[];
	preExcludedCrew: IVoyageCrew[];
	excludedCrewIds: number[];
	updateExclusions: (crewIds: number[]) => void;
};

type SelectedBonusType = '' | 'all' | 'featured' | 'matrix';

export const CrewExcluder = (props: CrewExcluderProps) => {
	const calculatorContext = React.useContext(CalculatorContext);
	const { events } = calculatorContext;
	const { excludedCrewIds, updateExclusions } = props;

	const [selectedEvent, setSelectedEvent] = React.useState<string>('');
	const [phase, setPhase] = React.useState<string>('');
	const [selectedBonus, setSelectedBonus] = React.useState<SelectedBonusType>('all');

	const excludeQuipped = () => {
		const quipped = props.rosterCrew.filter(f => !excludedCrewIds?.includes(f.id) && f.kwipment?.some(k => typeof k === 'number' ? !!k : !!k[1]))?.map(c => c.id);
		updateExclusions([ ... new Set([...excludedCrewIds, ...quipped])] );
	}

	React.useEffect(() => {
		let activeEvent: string = '';
		let activeBonus: SelectedBonusType = 'all';
		let phase = '';
		events.forEach(gameEvent => {
			if (gameEvent && gameEvent.seconds_to_end > 0 && gameEvent.seconds_to_start < 86400) {
				if (gameEvent.content_types.includes('shuttles') || gameEvent.content_types.includes('gather')) {
					activeEvent = gameEvent.symbol;

					let date = (new Date((new Date()).toLocaleString('en-US', { timeZone: 'America/New_York' })));
					if (Array.isArray(gameEvent.content_types) && gameEvent.content_types.length === 2) {
						if ((date.getDay() === 6 && date.getHours() >= 12) || date.getDay() <= 1) {
							phase = gameEvent.content_types[1];
						}
						else {
							phase = gameEvent.content_types[0];
						}						
					}
					else {
						phase = (gameEvent.content_types as any) as string;
					}
					if (phase === 'gather') {
						activeBonus = 'matrix';
					}
					else if (phase === 'shuttles') {
						activeBonus = 'all';
					}
					// if (!gameEvent.content_types.includes('shuttles')) activeBonus = 'featured';
				}
			}
		});
		setPhase(phase);
		setSelectedEvent(activeEvent);
		setSelectedBonus(activeBonus);
	}, [events]);

	React.useEffect(() => {
		if (selectedEvent && phase) {
			const activeEvent = events.find(gameEvent => gameEvent.symbol === selectedEvent);
			if (activeEvent) {
				if (selectedBonus === 'matrix') {
					let eventCrew = props.rosterCrew.map(m => m as IEventScoredCrew);
					let combos = computeEventBest(eventCrew, activeEvent, phase, undefined, true, false);
					const crewIds = Object.values(combos).map(cb => cb.id);
					updateExclusions([...new Set(crewIds)]);
				}
				else {
					const crewIds = props.rosterCrew.filter(c =>
						(selectedBonus === 'all' && activeEvent.bonus.includes(c.symbol))
						|| (selectedBonus === 'featured' && activeEvent.featured.includes(c.symbol))
					).sort((a, b) => a.name.localeCompare(b.name)).map(c => c.id);
					updateExclusions([...new Set(crewIds)]);
				}
			}
		}
		else {
			updateExclusions([]);
		}
	}, [selectedEvent, selectedBonus, phase]);

	const eventOptions = [] as ISelectOption[];
	events.forEach(gameEvent => {
		if (gameEvent.content_types.includes('shuttles') || gameEvent.content_types.includes('gather')) {
			if (gameEvent.bonus.length > 0) {
				eventOptions.push({
					key: gameEvent.symbol,
					value: gameEvent.symbol,
					text: gameEvent.name
				});
			}
		}
	});
	if (eventOptions.length > 0) eventOptions.push({ key: 'none', value: '', text: 'Do not exclude event crew' });

	const bonusOptions: ISelectOption[] = [
		{ key: 'all', value: 'all', text: 'All event crew' },
		{ key: 'featured', value: 'featured', text: 'Featured event crew' },
		
		// { key: 'best', value: 'best', text: 'My best crew for event' }
	];

	if (selectedEvent) {
		const activeEvent = events.find(gameEvent => gameEvent.symbol === selectedEvent);
		if (activeEvent?.content_types?.includes('gather')) {
			bonusOptions.push({ key: 'matrix', value: 'matrix', text: 'Event skill matrix crew' });
		}
	}

	return (
		<React.Fragment>
			<Message attached onDismiss={excludedCrewIds.length > 0 ? () => { updateExclusions([]); setSelectedEvent(''); } : undefined}>
				<Message.Content>
					<Message.Header>
						Crew to Exclude
					</Message.Header>
					<Form.Group grouped>
						{eventOptions.length > 0 && (
							<Form.Group inline>
								<Form.Field
									label='Exclude crew from the event'
									placeholder='Select event'
									control={Dropdown}
									fluid
									clearable
									selection
									options={eventOptions}
									value={selectedEvent}
									onChange={(e, { value }) => setSelectedEvent(value as string)}
								/>
								{selectedEvent !== '' && (
									<Form.Field
										label='Filter by bonus'
										control={Dropdown}
										fluid
										selection
										options={bonusOptions}
										value={selectedBonus}
										onChange={(e, { value }) => setSelectedBonus(value as SelectedBonusType)}
									/>
								)}
							</Form.Group>
						)}
						<Form.Field>
							<Button color='blue' onClick={(e) => excludeQuipped()}>Exclude Quipped Crew</Button>
						</Form.Field>
					</Form.Group>
				</Message.Content>
			</Message>
			<Segment attached='bottom'>
				{renderExcludedCrew()}
			</Segment>
		</React.Fragment>
	);

	function renderExcludedCrew(): JSX.Element {
		const visibleExcludedCrew = [] as IVoyageCrew[];
		excludedCrewIds.forEach(crewId => {
			const crew = props.preExcludedCrew.find(crew => crew.id === crewId);
			if (crew) visibleExcludedCrew.push(crew);
		});
		return (
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '.5em', alignItems: 'center' }}>
				{visibleExcludedCrew.map(crew => renderCrewLabel(crew))}
				<CrewExcluderModal
					rosterCrew={props.preExcludedCrew}
					excludedCrewIds={excludedCrewIds}
					updateExclusions={updateExclusions}
				/>
			</div>
		);
	}

	function renderCrewLabel(crew: IVoyageCrew): JSX.Element {
		return (
			<Label key={crew.id} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }}>
				<Image spaced='right' src={`${process.env.GATSBY_ASSETS_URL}${crew.imageUrlPortrait}`} />
				{crew.name}
				<Icon name='delete' onClick={() => deExcludeCrewId(crew.id)} />
			</Label>
		);
	}

	function deExcludeCrewId(crewId: number): void {
		const index = excludedCrewIds.indexOf(crewId);
		excludedCrewIds.splice(index, 1);
		updateExclusions([...excludedCrewIds]);
	}
};

type CrewExcluderModalProps = {
	rosterCrew: IVoyageCrew[];
	excludedCrewIds: number[];
	updateExclusions: (crewIds: number[]) => void;
};

const CrewExcluderModal = (props: CrewExcluderModalProps) => {
	const { excludedCrewIds } = props;

	const [options, setOptions] = React.useState<IExcluderModalOptions>(DEFAULT_EXCLUDER_OPTIONS);

	const pickerCrewList = props.rosterCrew.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<CrewPicker crewList={pickerCrewList}
			handleSelect={(crew) => onCrewPick(crew as IVoyageCrew)}
			options={options} setOptions={setOptions} defaultOptions={DEFAULT_EXCLUDER_OPTIONS}
			pickerModal={ExcluderOptionsModal} renderTrigger={renderTrigger}
			filterCrew={(data, searchFilter) => filterCrew(data as IVoyageCrew[], searchFilter)}
		/>
	);

	function renderTrigger(): JSX.Element {
		return (
			<Button color='blue'>
				<Icon name='zoom-in' />
				Search for crew to exclude
			</Button>
		);
	}

	function filterCrew(data: IVoyageCrew[], searchFilter: string = ''): IVoyageCrew[]{
		const query = (input: string) => input.toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(searchFilter.toLowerCase().replace(/[^a-z0-9]/g, '')) >= 0;
		data = data.filter(crew =>
			true
				&& (options.rarities.length === 0 || options.rarities.includes(crew.max_rarity))
				&& (searchFilter === '' || (query(crew.name) || query(crew.short_name)))
		);
		return data;
	}

	function onCrewPick(crew: IVoyageCrew): void {
		if (!excludedCrewIds.includes(crew.id)) {
			excludedCrewIds.push(crew.id);
			props.updateExclusions([...excludedCrewIds]);
		}
	}
};

interface IExcluderModalOptions extends OptionsBase {
	rarities: number[];
};

const DEFAULT_EXCLUDER_OPTIONS = {
	rarities: []
} as IExcluderModalOptions;

class ExcluderOptionsModal extends OptionsModal<IExcluderModalOptions> {
	state: { isDefault: boolean; isDirty: boolean; options: any; modalIsOpen: boolean; };
	props: any;

	protected getOptionGroups(): OptionGroup[] {
		return [
			{
				title: 'Filter by rarity:',
				key: 'rarities',
				multi: true,
				options: ExcluderOptionsModal.rarityOptions,
				initialValue: [] as number[]
			}]
	}
	protected getDefaultOptions(): IExcluderModalOptions {
		return DEFAULT_EXCLUDER_OPTIONS;
	}

	static readonly rarityOptions = [
		{ key: '1*', value: 1, text: '1* Common' },
		{ key: '2*', value: 2, text: '2* Uncommon' },
		{ key: '3*', value: 3, text: '3* Rare' },
		{ key: '4*', value: 4, text: '4* Super Rare' },
		{ key: '5*', value: 5, text: '5* Legendary' }
	];

	constructor(props: OptionsModalProps<IExcluderModalOptions>) {
		super(props);

		this.state = {
			isDefault: false,
			isDirty: false,
			options: props.options,
			modalIsOpen: false
		}
	}

	protected checkState(): boolean {
		const { options } = this.state;

		const isDefault = options.rarities.length === 0;
		const isDirty = options.rarities.length !== this.props.options.rarities.length || !this.props.options.rarities.every(r => options.rarities.includes(r));

		if (this.state.isDefault !== isDefault || this.state.isDirty !== isDirty) {
			this.setState({ ...this.state, isDefault, isDirty });
			return true;
		}

		return false;
	}
};
