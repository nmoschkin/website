import React from 'react';
import {
	Dropdown,
	DropdownItemProps,
	Form
} from 'semantic-ui-react';

import { PlayerCrew } from '../../../model/player';
import { IEventData } from '../../eventplanner/model';

type EventCrewFilterProps = {
	value: string;
	setValue: (eventFilter: string) => void;
	events: IEventData[];
};

export const EventCrewFilter = (props: EventCrewFilterProps) => {
	const { value, setValue, events } = props;

	const [selectedEvent, setSelectedEvent] = React.useState<string>(value !== '' ? value.split(',')[0] : '') ;
	const [selectedBonus, setSelectedBonus] = React.useState<string>(value !== '' ? value.split(',')[1] : '');

	const eventOptions = React.useMemo<DropdownItemProps[]>(() => {
		const eventTypes = {
			'gather' : 'Galaxy',
			'shuttles': 'Faction',
			'skirmish': 'Skirmish',
			'voyage': 'Voyage'
		};
		const eventOptions: DropdownItemProps[] = [
			{ key: 'all', value: '', text: 'Show all crew' }	/* Show all crew */
		];
		events.filter(eventData => eventData.seconds_to_end > 0)
			.sort((a, b) => a.seconds_to_start - b.seconds_to_start)
			.forEach(eventData => {
				const contentTypes: string[] = [];
				eventData.content_types.forEach(contentType => {
					if (!contentTypes.includes(contentType))
						contentTypes.push(contentType);
				});
				eventOptions.push(
					{
						key: eventData.symbol,
						value: eventData.symbol,
						text: `"${eventData.name}" (${contentTypes.map(type => eventTypes[type]).join(', ')})`
					}
				);
			});
		return eventOptions;
	}, [events]);

	React.useEffect(() => {
		if (selectedEvent === '')
			setSelectedBonus('');
		else
			setSelectedBonus('is:bonus');
	}, [selectedEvent]);

	React.useEffect(() => {
		if (selectedBonus === '')
			setValue('');
		else
			setValue(`${selectedEvent},${selectedBonus}`);
	}, [selectedBonus]);

	if (events.length === 0) return <></>;

	const bonusOptions: DropdownItemProps[] = [
		{	/* Only show event crew */
			key: 'all',
			value: 'is:bonus',
			text: 'Only show event crew'
		},
		{	/* Hide event crew */
			key: `not:bonus`,
			value: `not:bonus`,
			text: `Hide event crew`
		},
		{	/* Only show featured crew */
			key: `is:featured`,
			value: `is:featured`,
			text: `Only show featured crew`
		},
		{	/* Hide featured crew */
			key: `not:featured`,
			value: `not:featured`,
			text: `Hide featured crew`
		}
	];

	return (
		<React.Fragment>
			<Form.Field	/* Filter by event */
				placeholder='Filter by event'
				control={Dropdown}
				selection
				clearable
				options={eventOptions}
				value={selectedEvent}
				onChange={(e, { value }) => setSelectedEvent(value as string)}
			/>
			{selectedEvent !== '' && (
				<Form.Field	/* Filter by bonus */
					placeholder='Filter by bonus'
					control={Dropdown}
					selection
					options={bonusOptions}
					value={selectedBonus}
					onChange={(e, { value }) => setSelectedBonus(value as string)}
				/>
			)}
		</React.Fragment>
	);
};

export function crewMatchesEventFilter(crew: PlayerCrew, eventFilter: string, events: IEventData[]): boolean {
	if (eventFilter === '') return true;
	const [eventSymbol, bonusFilter] = eventFilter.split(',');
	const eventData = events.find(e => e.symbol === eventSymbol);
	if (eventData) {
		const [filterType, bonusType] = bonusFilter.split(':');
		const isEventCrew: boolean = (bonusType === 'featured' ? eventData.featured : eventData.bonus).includes(crew.symbol);
		if (isEventCrew && filterType === 'is') return true;
		if (!isEventCrew && filterType === 'not') return true;
	}
	return false;
}