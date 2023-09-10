import React from 'react';
import { Header, Message, Tab, Icon, Dropdown, Menu, Button, Form, TextArea, Checkbox, Modal, Progress, Popup } from 'semantic-ui-react';

import ProfileCrew from '../components/profile_crew';
import ProfileCrewMobile from '../components/profile_crew2';
import ProfileShips from '../components/profile_ships';
import ProfileItems from '../components/profile_items';
import ProfileOther from '../components/profile_other';
import ProfileCharts from '../components/profile_charts';

import CiteOptimizer from '../components/citeoptimizer';
import CollectionsTool from '../components/collectionstool';
import EventPlanner from '../components/eventplanner';
import VoyageCalculator from '../components/voyagecalculator';
import CrewRetrieval from '../components/crewretrieval';
import FactionInfo from '../components/factions';
import UnneededItems from '../components/unneededitems';
import FleetBossBattles from '../components/fleetbossbattles';

import { exportCrew, downloadData } from '../utils/crewutils';
import { useStateWithStorage } from '../utils/storage';
import { PlayerCrew, PlayerData } from '../model/player';
import { BossBattlesRoot } from '../model/boss';
import ShipProfile from '../components/ship_profile';
import { Ship } from '../model/ship';
import { GlobalContext } from '../context/globalcontext';
import { BuffStatTable } from '../utils/voyageutils';
import { EquipmentItem } from '../model/equipment';
import DataPageLayout from '../components/page/datapagelayout';
import { EphemeralData } from '../context/playercontext';
import { navigate } from 'gatsby';
import { v4 } from 'uuid';

export interface PlayerTool {
	title: string;
	render: (props: { rand?: string, crew?: PlayerCrew, ship?: string, location?: any }) => JSX.Element;
	noMenu?: boolean;
}

export interface PlayerTools {
	[key: string]: PlayerTool;
}

export const playerTools: PlayerTools = {
	'voyage': {
		title: 'Voyage Calculator',
		render: () => <VoyageCalculator />
	},
	'event-planner': {
		title: 'Event Planner',
		render: () => <EventPlanner />
	},
	'crew': {
		title: 'Crew',
		render: ({ location }) => <ProfileCrew isTools={true} location={location} />
	},
	'crew-mobile': {
		title: 'Crew (mobile)',
		render: () => <ProfileCrewMobile isMobile={false} />
	},
	'crew-retrieval': {
		title: 'Crew Retrieval',
		render: () => <CrewRetrieval />
	},
	'cite-optimizer': {
		title: 'Citation Optimizer',
		render: () => <CiteOptimizer />
	},
	'collections': {
		title: 'Collections',
		render: () => <CollectionsTool />
	},
	'fleetbossbattles': {
		title: 'Fleet Boss Battles',
		render: () => <FleetBossBattles />
	},
	'ships': {
		title: 'Ships',
		render: () => <ProfileShips />
	},
	'ship': {
		title: 'Ship Details',
		render: () => <ShipProfile />,
		noMenu: true
	},
	'factions': {
		title: 'Factions',
		render: () => <FactionInfo />
	},
	'items': {
		title: 'Items',
		render: () => <ProfileItems />
	},
	'unneeded': {
		title: 'Unneeded Items',
		render: () => <UnneededItems />
	},
	'other': {
		title: 'Other',
		render: () => <ProfileOther />
	},
	'charts': {
		title: 'Charts & Stats',
		render: () => <ProfileCharts />
	},
	'fwdgaunt': {
		title: "Gauntlets",
		render: () => <>{navigate("/gauntlets")}</>,
		noMenu: true
	}
};


const PlayerToolsPage = (props: any) => {

	return (
		<DataPageLayout pageTitle='Player Tools' demands={['ship_schematics', 'crew', 'items', 'skill_bufs','cadet']} playerPromptType='require'>
				<PlayerToolsComponent location={props.location} />
		</DataPageLayout>
	);
};

export interface PlayerToolsProps {
	location: any;
}

const PlayerToolsComponent = (props: PlayerToolsProps) => {
	const mergedContext = React.useContext(GlobalContext);
	// The context above

	const { playerShips, playerData } = mergedContext.player;
	const { dataSource, ephemeral } = mergedContext.player;

	const [rand, setRand] = React.useState(v4());

	React.useEffect(() => {
		setRand(v4());
	}, [playerData, ephemeral]);

	// Profile data ready, show player tool panes
	if (playerData && dataSource && dataSource && ephemeral && playerShips && !!rand) {
		return (<PlayerToolsPanes rand={rand} />);
	}
	else {
		return <></>
	}
}

type PlayerToolsPanesProps = {
	rand: string;
};

const PlayerToolsPanes = (props: PlayerToolsPanesProps) => {
	const context = React.useContext(GlobalContext);

	const { playerShips } = context.player;

	const [activeTool, setActiveTool] = React.useState('');
	const [selectedShip, setSelectedShip] = useStateWithStorage<string | undefined>('tools/selectedShip', undefined);
	const { rand } = props;

	const tools = playerTools;
	React.useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.has('tool') && tools[urlParams.get('tool') as string])
			setActiveTool(urlParams.get('tool') as string);

		if (urlParams.has('ship')) {
			setSelectedShip(urlParams.get('ship') ?? undefined);
		}
		else {
			setSelectedShip(undefined);
		}
	}, [window.location.search]);

	let tt: string | undefined = undefined;

	if ((activeTool != '') && tools[activeTool].title === 'Ship Page' && selectedShip) {
		let s = playerShips?.find((sp) => sp.symbol === selectedShip);
		if (s) {
			tt = s.name;
		}
	}

	return (
		<>
			<React.Fragment>
				{((activeTool ?? "") != "") ? tools[activeTool].render({ rand }) : ""}
			</React.Fragment>
		</>
	);
}

export default PlayerToolsPage;
