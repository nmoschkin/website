import React from 'react';
import {
	Button,
	Form,
	Icon
} from 'semantic-ui-react';

import { Skill } from '../../../model/crew';
import { PlayerCrew } from '../../../model/player';
import { IVoyageCrew } from '../../../model/voyage';
import { GlobalContext } from '../../../context/globalcontext';
import { useStateWithStorage } from '../../../utils/storage';

import CONFIG from '../../CONFIG';
import { RarityFilter } from '../../crewtables/commonoptions';
import { IDataGridSetup, IDataTableColumn, IDataTableSetup, IEssentialData } from '../../dataset_presenters/model';
import { DataPicker, DataPickerLoading } from '../../dataset_presenters/datapicker';
import { CrewLabel } from '../../dataset_presenters/elements/crewlabel';
import { CrewPortrait } from '../../dataset_presenters/elements/crewportrait';
import { AvailabilityCrewFilter, crewMatchesAvailabilityFilter } from '../../dataset_presenters/options/availabilitycrewfilter';
import { crewMatchesEventFilter, EventCrewFilter } from '../../dataset_presenters/options/eventcrewfilter';
import { crewMatchesQuippedFilter, QuippedCrewFilter } from '../../dataset_presenters/options/quippedcrewfilter';
import { crewMatchesSkillFilter, SkillToggler } from '../../dataset_presenters/options/skilltoggler';

import { CalculatorContext } from '../context';

import { EditorContext } from './context';

interface IAlternateCrewData extends PlayerCrew {
	assigned_slot: number;
	status: number;
	voyage_total: number;
	scored_command_skill: number;
	scored_diplomacy_skill: number;
	scored_engineering_skill: number;
	scored_medicine_skill: number;
	scored_science_skill: number;
	scored_security_skill: number;
};

interface IPickerFilters {
	availability: string;
	event: string;
	quipped: string;
	rarity: number[];
	skills: string[];
};

const defaultFilters: IPickerFilters = {
	availability: '',
	event: '',
	quipped: '',
	rarity: [],
	skills: []
};

type AlternateCrewPickerProps = {
	roster: IVoyageCrew[];
	setAlternate: (alternateCrew: PlayerCrew) => void;
};

export const AlternateCrewPicker = (props: AlternateCrewPickerProps) => {
	const { t } = React.useContext(GlobalContext).localized;
	const calculatorContext = React.useContext(CalculatorContext);
	const { id, prospectiveConfig, sortedSkills, renderActions, dismissEditor } = React.useContext(EditorContext);
	const { roster, setAlternate } = props;

	const [filters, setFilters] = useStateWithStorage<IPickerFilters>(`${id}/alternatepicker/filters`, {...defaultFilters});
	const [skillMode, setSkillMode] = useStateWithStorage<'voyage' | 'proficiency'>(`${id}/alternatepicker/skillMode`, 'voyage');
	const [prospectMode, setProspectMode] = useStateWithStorage<boolean>(`${id}/alternatepicker/prospectMode`, false);

	const [data, setData] = React.useState<IAlternateCrewData[] | undefined>(undefined);

	React.useEffect(() => {
		const assignedCrewIds: number[] = prospectiveConfig.crew_slots.filter(cs => cs.crew).map(cs => cs.crew!.id);
		const data: IAlternateCrewData[] = JSON.parse(JSON.stringify(roster));
		data.forEach(crew => {
			const assignedSlot: number = assignedCrewIds.indexOf(crew.id);
			crew.assigned_slot = assignedSlot >= 0 ? assignedSlot : 100; // Unassigned crew get a high slot # for sorting purposes

			crew.status = crew.active_status;
			if (crew.immortal > 0) crew.status = 100; // Frozen crew get a high status # for sorting purposes

			let primaryScore: number = 0, secondaryScore: number = 0, otherScore: number = 0;
			Object.keys(CONFIG.SKILLS).forEach(skill => {
				let scoredSkill: number = 0;
				const crewSkill: Skill | undefined = crew.skills[skill];
				if (crewSkill) {
					const proficiency: number = (crewSkill.range_min + crewSkill.range_max) / 2;
					const voyageScore: number = crewSkill.core + proficiency;
					if (skill === calculatorContext.voyageConfig.skills.primary_skill)
						primaryScore = voyageScore;
					else if (skill === calculatorContext.voyageConfig.skills.secondary_skill)
						secondaryScore = voyageScore;
					else
						otherScore += voyageScore;
					if (skillMode === 'voyage')
						scoredSkill = voyageScore;
					else if (skillMode === 'proficiency')
						scoredSkill = crewSkill.range_max;
				}
				crew[`scored_${skill}`] = scoredSkill;
			});
			crew.voyage_total = primaryScore + secondaryScore + otherScore;
		});
		setData([...data]);
	}, [roster, prospectiveConfig.crew_slots, skillMode]);

	const filteredIds = React.useMemo<Set<number>>(() => {
		const filteredIds: Set<number> = new Set<number>();
		data?.forEach(crew => {
			const canShowCrew: boolean =
				(!prospectMode || (crew.assigned_slot >= 0 && crew.assigned_slot < 12))
					&& (filters.rarity.length === 0 || filters.rarity.includes(crew.max_rarity))
					&& (crewMatchesSkillFilter(crew, filters.skills))
					&& (crewMatchesAvailabilityFilter(crew, filters.availability))
					&& (crewMatchesEventFilter(crew, filters.event, calculatorContext.events))
					&& (crewMatchesQuippedFilter(crew, filters.quipped));
			if (!canShowCrew) filteredIds.add(crew.id);
		});
		return filteredIds;
	}, [data, filters, prospectMode]);

	if (!data) return <DataPickerLoading />;

	const gridSetup: IDataGridSetup = {
		renderGridColumn: renderGridCrew
	};

	const columns: IDataTableColumn[] = [
		{	/* Prospective voyage seat */
			id: 'slot',
			title: <Icon name='vcard' title='Prospective voyage seat' />,
			align: 'center',
			sortField: { id: 'assigned_slot' },
			renderCell: (datum: IEssentialData) => renderCrewAssignment(datum as IAlternateCrewData)
		},
		{
			id: 'name',
			title: 'Crew',
			sortField: { id: 'name', stringValue: true },
			renderCell: (datum: IEssentialData) => <CrewLabel crew={datum as IAlternateCrewData} />
		},
		{
			id: 'status',
			title: 'Status',
			align: 'center',
			sortField: { id: 'status' },
			renderCell: (datum: IEssentialData) => renderCrewStatus(datum as IAlternateCrewData)
		},
		{
			id: 'voyage',
			title: 'Voyage',
			align: 'center',
			sortField: { id: 'voyage_total', firstSort: 'descending' },
			renderCell: (datum: IEssentialData) => <>{Math.floor((datum as IAlternateCrewData).voyage_total)}</>
		}
	];

	sortedSkills.forEach(skill => {
		columns.push({
			id: skill,
			title: renderSkillHeader(skill),
			align: 'center',
			sortField: {
				id: `scored_${skill}`,
				firstSort: 'descending'
			},
			renderCell: (datum: IEssentialData) => (
				<React.Fragment>
					{datum[`scored_${skill}`] > 0 ? Math.floor(datum[`scored_${skill}`]): ''}
				</React.Fragment>
			)
		});
	});

	const tableSetup: IDataTableSetup = {
		columns,
		rowsPerPage: 12
	};

	return (
		<DataPicker	/* Search for alternate voyage crew by name */
			id={`${id}/alternatepicker/datapicker`}
			data={data}
			closePicker={handleSelectedIds}
			selection
			closeOnChange
			preFilteredIds={filteredIds}
			search
			searchPlaceholder='Search for alternate voyage crew by name'
			renderOptions={renderOptions}
			renderActions={renderActions}
			gridSetup={gridSetup}
			tableSetup={tableSetup}
		/>
	);

	function handleSelectedIds(selectedIds: Set<number>, affirmative: boolean): void {
		if (!affirmative) dismissEditor();
		if (selectedIds.size > 0) {
			const alternateId: number = [...selectedIds][0];
			const alternateCrew: PlayerCrew | undefined = data?.find(datum =>
				datum.id === alternateId
			);
			if (alternateCrew)
				setAlternate(alternateCrew);
		}
	}

	function renderOptions(): JSX.Element {
		return (
			<AlternatePickerOptions
				filters={filters} setFilters={setFilters}
				skillMode={skillMode} setSkillMode={setSkillMode}
				prospectMode={prospectMode} setProspectMode={setProspectMode}
			/>
		);
	}

	function renderGridCrew(datum: IEssentialData): JSX.Element {
		return <CrewPortrait crew={datum as IAlternateCrewData} />;
	}

	function renderSkillHeader(skill: string): JSX.Element {
		return (
			<React.Fragment>
				<img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${skill}.png`} style={{ height: '1.1em', verticalAlign: 'middle' }} />
				{calculatorContext.voyageConfig.skills.primary_skill === skill && <Icon name='star' color='yellow' />}
				{calculatorContext.voyageConfig.skills.secondary_skill === skill && <Icon name='star' color='grey' />}
			</React.Fragment>
		);
	}

	function renderCrewAssignment(crew: IAlternateCrewData): JSX.Element {
		if (crew.assigned_slot < 0 || crew.assigned_slot >= 12) return <></>;
		const slottedSkills: string[] = [
			'command_skill', 'diplomacy_skill', 'security_skill',
			'engineering_skill', 'science_skill', 'medicine_skill'
		];
		const skillSlot: number = Math.floor(crew.assigned_slot/2);
		return <img src={`${process.env.GATSBY_ASSETS_URL}atlas/icon_${slottedSkills[skillSlot]}.png`} style={{ height: '1.1em', verticalAlign: 'middle' }} />
	}

	function renderCrewStatus(crew: IAlternateCrewData): JSX.Element {
		if (crew.immortal > 0) {
			return (
				<Icon	/* Unfreeze crew */
					name='snowflake'
					title={t('voyage.crew_finder_hints.unfreeze_crew')}
				/>
			);
		}
		else if (crew.active_status === 2) {
			return (
				<Icon	/* On shuttle */
					name='space shuttle'
					title={t('voyage.crew_finder_hints.on_shuttle')}
				/>
			);
		}
		else if (crew.active_status === 3) {
			return (
				<Icon	/* On voyage */
					name='rocket'
					title={t('voyage.crew_finder_hints.on_voyage')}
				 />
			);
		}
		return <></>;
	}
};

type AlternatePickerOptionsProps = {
	filters: IPickerFilters;
	setFilters: (filters: IPickerFilters) => void;
	skillMode: 'voyage' | 'proficiency';
	setSkillMode: (skillMode: 'voyage' | 'proficiency') => void;
	prospectMode: boolean;
	setProspectMode: (prospectMode: boolean) => void;
};

const AlternatePickerOptions = (props: AlternatePickerOptionsProps) => {
	const calculatorContext = React.useContext(CalculatorContext);
	const { filters, setFilters, skillMode, setSkillMode, prospectMode, setProspectMode } = props;

	return (
		<Form>
			<Form.Group widths='equal'>
				{calculatorContext.rosterType === 'myCrew' && (
					<AvailabilityCrewFilter
						value={filters.availability}
						setValue={(value: string) => setFilters({...filters, availability: value})}
						rosterCrew={calculatorContext.crew}
					/>
				)}
				<EventCrewFilter
					value={filters.event}
					setValue={(value: string) => setFilters({...filters, event: value})}
					events={calculatorContext.events}
				/>
				{calculatorContext.rosterType === 'myCrew' && (
					<QuippedCrewFilter
						value={filters.quipped}
						setValue={(value: string) => setFilters({...filters, quipped: value})}
					/>
				)}
			</Form.Group>
			<Form.Group widths='equal'>
				<RarityFilter
					rarityFilter={filters.rarity}
					setRarityFilter={(value: number[]) => setFilters({...filters, rarity: value})}
				/>
				<SkillToggler
					value={filters.skills}
					setValue={(value: string[]) => setFilters({...filters, skills: value})}
				/>
			</Form.Group>
			<Form.Group style={{ justifyContent: 'space-between', marginBottom: '0' }}>
				<Form.Field	/* Show skill values in table: */
					inline
					width={8}
				>
					<label>Show skill values in table:</label>
					<Button.Group>
						<Button	/* Voyage score */
							content='Voyage score'
							color={skillMode === 'voyage' ? 'blue' : undefined}
							onClick={() => setSkillMode('voyage')}
						/>
						<Button	/* Max proficiency */
							content='Max proficiency'
							color={skillMode === 'proficiency' ? 'blue' : undefined}
							onClick={() => setSkillMode('proficiency')}
						/>
					</Button.Group>
				</Form.Field>
				<Form.Field>
					<Button	/* Only show prospective voyagers */
						content='Only show prospective voyagers'
						color={prospectMode ? 'blue' : undefined}
						onClick={() => {
							if (!prospectMode) setFilters({...defaultFilters});
							setProspectMode(!prospectMode);
						}}
					/>
				</Form.Field>
				<Form.Field>
					<Button	/* Reset */
						content='Reset'
						onClick={() => {
							setFilters({...defaultFilters});
							setSkillMode('voyage');
							setProspectMode(false);
						}}
					/>
				</Form.Field>
			</Form.Group>
		</Form>
	);
};