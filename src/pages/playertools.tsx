import React from 'react';
import { Header, Message, Tab, Icon, Dropdown, Menu, Button, Form, TextArea, Checkbox, Modal, Progress, Popup } from 'semantic-ui-react';
import { navigate } from 'gatsby';

import Layout from '../components/layout';
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

import { exportCrew, downloadData, prepareProfileData } from '../utils/crewutils';
import { stripPlayerData } from '../utils/playerutils';
import { useStateWithStorage } from '../utils/storage';
import { CompactCrew, GameEvent, PlayerEquipmentItem, PlayerCrew, PlayerData, Voyage, VoyageDescription, VoyageInfo } from '../model/player';
import { BossBattlesRoot } from '../model/boss';
import { ShuttleAdventure } from '../model/shuttle';
import ShipProfile from '../components/ship_profile';
import { Ship } from '../model/ship';
import { EventData } from '../utils/events';

export interface PlayerTool {
	title: string;
	render: (props: {playerData: PlayerData, allCrew: PlayerCrew[], crew?: PlayerCrew, ship?: string, location?: any}) => JSX.Element;	
}

export interface PlayerTools {
	[key: string]: PlayerTool;
}

export const playerTools: PlayerTools = {
	'voyage': {
		title: 'Voyage Calculator',
		render: ({playerData, allCrew}) => <VoyageCalculator playerData={playerData} allCrew={allCrew} />
	},
	'event-planner': {
		title: 'Event Planner',
		render: ({playerData, allCrew}) => <EventPlanner playerData={playerData} allCrew={allCrew} />
	},
	'crew': {
		title: 'Crew',
		render: ({playerData, allCrew, location}) => <ProfileCrew playerData={playerData} isTools={true} allCrew={allCrew} location={location} />
	},
	'crew-mobile': {
		title: 'Crew (mobile)',
		render: ({playerData, allCrew}) => <ProfileCrewMobile allCrew={allCrew} playerData={playerData} isMobile={false} />
	},
	'crew-retrieval': {
		title: 'Crew Retrieval',
		render: ({playerData, allCrew}) => <CrewRetrieval playerData={playerData} allCrew={allCrew} />
	},
	'cite-optimizer': {
		title: 'Citation Optimizer',
		render: ({playerData, allCrew}) => <CiteOptimizer playerData={playerData} allCrew={allCrew} />
	},
	'collections': {
		title: 'Collections',
		render: ({playerData, allCrew}) => <CollectionsTool playerData={playerData} allCrew={allCrew} />
	},
	'fleetbossbattles': {
		title: 'Fleet Boss Battles',
		render: ({playerData, allCrew}) => <FleetBossBattles playerData={playerData} allCrew={allCrew} />
	},
	'ships': {
		title: 'Ships',
		render: ({playerData}) => <ProfileShips playerData={playerData} />
	},
	// 'ship': {
	// 	title: 'Ship Page',
	// 	render: ({playerData, allCrew, ship}) => <ShipProfile ship={ship} allCrew={allCrew} playerData={playerData} />
	// },
	'factions': {
		title: 'Factions',
		render: ({playerData}) => <FactionInfo
							factionInfo={playerData.player.character.factions}
							shuttleBays={playerData.player.character.shuttle_bays}
						/>
	},
	'items': {
		title: 'Items',
		render: ({playerData}) => <ProfileItems playerData={playerData} />
	},
	'unneeded': {
		title: 'Unneeded Items',
		render: ({playerData}) => <UnneededItems playerData={playerData} />
	},
	'other': {
		title: 'Other',
		render: ({playerData}) => <ProfileOther playerData={playerData} />
	},
	'charts': {
		title: 'Charts & Stats',
		render: ({playerData}) => <ProfileCharts playerData={playerData} />
	}
};

const PlayerToolsPage = (props: any) =>  {
	const [playerData, setPlayerData] = React.useState<PlayerData | undefined>(undefined);
	const [inputPlayerData, setInputPlayerData] = React.useState<PlayerData | undefined>(undefined);

	// allCrew will always be set and can be passed as a prop to subcomponents that need it, saving a fetch to crew.json
	// allItems is NOT always set; it can be passed to subcomponents but requires a check to see if defined
	const [allCrew, setAllCrew] = React.useState<PlayerCrew[] | undefined>(undefined);
	const [allItems, setAllItems] = React.useState<PlayerEquipmentItem[] | undefined>(undefined);

	const [strippedPlayerData, setStrippedPlayerData] = useStateWithStorage<PlayerData | undefined>('tools/playerData', undefined);
	const [voyageData, setVoyageData] = useStateWithStorage<VoyageInfo | undefined>('tools/voyageData', undefined);
	const [eventData, setEventData] = useStateWithStorage<GameEvent[] | undefined>('tools/eventData', undefined);
	const [fleetbossData, setFleetbossData] = useStateWithStorage<BossBattlesRoot | undefined>('tools/fleetbossData', undefined);
	const [activeCrew, setActiveCrew] = useStateWithStorage<CompactCrew[] | undefined>('tools/activeCrew', undefined);
	const [activeShuttles, setActiveShuttles] = useStateWithStorage<ShuttleAdventure[] | undefined>('tools/activeShuttles', undefined);

	const [dataSource, setDataSource] = React.useState<string | undefined>(undefined);
	const [showForm, setShowForm] = React.useState(false);
	const [selectedShip, setSelectedShip] = useStateWithStorage<string | undefined>('tools/selectedShip', undefined);

	// Profile data ready, show player tool panes
	if (playerData && !showForm && activeCrew && dataSource && allCrew && fleetbossData) {
		return (<PlayerToolsPanes
					playerData={playerData}
					strippedPlayerData={strippedPlayerData}
					voyageData={voyageData}
					eventData={eventData}
					activeCrew={activeCrew}
					dataSource={dataSource}
					ship={selectedShip}
					allCrew={allCrew}
					allItems={allItems}
					requestShowForm={setShowForm}
					requestClearData={clearPlayerData}
					location={props.location}
				/>);
	}

	// Preparing profile data, show spinner
	if ((inputPlayerData || strippedPlayerData) && !showForm) {
		if (inputPlayerData) {
			if (allCrew && allItems)
				prepareProfileDataFromInput();
			else if (!allItems)
				fetchAllItemsAndCrew();
		}
		else {
			if (allCrew)
				prepareProfileDataFromSession();
			else
				fetchAllCrew();
		}
		return (<PlayerToolsLoading />);
	}

	// No data available, show input form
	return (<PlayerToolsForm setValidInput={setValidInput} />);

	function setValidInput(inputData : any) {
		setPlayerData(undefined);
		setInputPlayerData(inputData);
		setShowForm(false);
	}

	async function fetchAllItemsAndCrew() {
		const [itemsResponse, crewResponse] = await Promise.all([
			fetch('/structured/items.json'),
			fetch('/structured/crew.json'),
		]);
		const [allitems, allcrew] = await Promise.all([
			itemsResponse.json(),
			crewResponse.json()
		]);
		setAllItems(allitems);
		setAllCrew(allcrew);
	}

	// Only crew data is needed if loading profile from session
	//	Does this really save any time, or should we just use fetchAllItemsAndCrew every time playertools is loaded?
	async function fetchAllCrew() {
		const crewResponse = await fetch('/structured/crew.json');
		const allcrew = await crewResponse.json();
		setAllCrew(allcrew);
	}

	function prepareProfileDataFromInput() {
		// Reset session before storing new variables
		sessionStorage.clear();

		// Active crew, active shuttles, voyage data, and event data will be stripped from playerData,
		//	so store a copy for player tools (i.e. voyage calculator, event planner)
		if (!inputPlayerData) return false;
		if (inputPlayerData.item_archetype_cache){
			inputPlayerData.version = 17;
		}
		else if (inputPlayerData.archetype_cache) {
			inputPlayerData.version = 20;
			inputPlayerData.item_archetype_cache = {
				archetypes: inputPlayerData.archetype_cache.archetypes.map((a: Archetype20) => {
					return {
						id: a.id,
						symbol: a.symbol,
						type: a.item_type,
						name: a.name,
						icon: a.icon,
						flavor: a.flavor,
						rarity: a.rarity,
						recipe: a.recipe,
						item_sources: a.item_sources,
						bonuses: a.bonuses,
						short_name: a.short_name
					} as Archetype17;
				})
			}
		}

		let activeCrew = [] as CompactCrew[];
		inputPlayerData.player.character.crew.forEach(crew => {
			if (crew.active_status > 0) {
				activeCrew.push({ symbol: crew.symbol, rarity: crew.rarity, level: crew.level, equipment: crew.equipment.map((eq) => eq[0]), active_status: crew.active_status });
			}
		});
		let voyageData = {
			voyage_descriptions: [...inputPlayerData.player.character.voyage_descriptions ?? []],
			voyage: [...inputPlayerData.player.character.voyage ?? []],
		}
		setVoyageData(voyageData);
		setEventData([...inputPlayerData.player.character.events ?? []]);
		setFleetbossData(inputPlayerData.fleet_boss_battles_root);
		setActiveCrew(activeCrew);
    
		if (inputPlayerData.player.character.shuttle_adventures) {
			inputPlayerData.player.character.crew
				.filter(crew => crew.active_status === 2)
				.forEach(crew => {
					let shuttle = inputPlayerData.player.character.shuttle_adventures?.find(x => x.shuttles[0].id === crew.active_id);
					if (shuttle) {
						shuttle.shuttles[0].slots[crew.active_index].crew_symbol = crew.symbol;
					}
				});
		}

		setActiveShuttles([...inputPlayerData.player.character.shuttle_adventures ?? []]);

		let dtImported = new Date();

		// strippedPlayerData is used for any storage purpose, i.e. sharing profile and keeping in session
		let strippedData = stripPlayerData(allItems ?? [], {...inputPlayerData});
		strippedData.calc = { 'lastImported': dtImported };
		setStrippedPlayerData(JSON.parse(JSON.stringify(strippedData)));

		// preparedProfileData is expanded with useful data and helpers for DataCore and hopefully generated once
		//	so other components don't have to keep calculating the same data
		// After this point, playerData should always be preparedProfileData, here and in all components
		let preparedProfileData = {...strippedData};
		prepareProfileData("prepareProfileDataFromInput", allCrew ?? [], preparedProfileData, dtImported);
		setPlayerData(preparedProfileData);
		setDataSource('input');
	}

	function prepareProfileDataFromSession() {
		let preparedProfileData = {...strippedPlayerData} as PlayerData;
		prepareProfileData("prepareProfileDataFromSession", allCrew ?? [], preparedProfileData, new Date(Date.parse(strippedPlayerData?.calc?.lastImported as string)));
		setPlayerData(preparedProfileData);
		setDataSource('session');
	}

	function clearPlayerData() {
		sessionStorage.clear();	// also clears form data for all subcomponents
		[setPlayerData, setInputPlayerData, setStrippedPlayerData]
			.forEach(setFn => { setFn(undefined); });
	}
}

type PlayerToolsPanesProps = {
	playerData: PlayerData;
	strippedPlayerData?: PlayerData;
	voyageData?: VoyageInfo;
	eventData?: GameEvent[];
	activeCrew: CompactCrew[];
	dataSource: string;
	allCrew: PlayerCrew[];
	ship?: string;
	allItems?: PlayerEquipmentItem[];
	requestShowForm: (showForm: boolean) => void;
	requestClearData: () => void;
	location: any;
};

const PlayerToolsPanes = (props: PlayerToolsPanesProps) => {
	const { playerData, strippedPlayerData, voyageData, eventData, activeCrew, dataSource,
			allCrew, allItems, requestShowForm, requestClearData } = props;

	const [showIfStale, setShowIfStale] = useStateWithStorage('tools/showStale', true);

	const [showShare, setShowShare] = useStateWithStorage(playerData.player.dbid+'/tools/showShare', true, { rememberForever: true, onInitialize: variableReady });
	const [profileAutoUpdate, setProfileAutoUpdate] = useStateWithStorage(playerData.player.dbid+'/tools/profileAutoUpdate', false, { rememberForever: true });
	const [profileUploaded, setProfileUploaded] = React.useState(false);
	const [profileUploading, setProfileUploading] = React.useState(false);
	const [profileShared, setProfileShared] = useStateWithStorage('tools/profileShared', false);

	const [varsReady, setVarsReady] = React.useState(false);
	const [activeTool, setActiveTool] = React.useState('voyage');
	const [selectedShip, setSelectedShip] = useStateWithStorage<string | undefined>('tools/selectedShip', undefined);

	React.useEffect(() => {
		if (dataSource == 'input' && profileAutoUpdate && !profileUploaded) {
			console.log('Uploading profile');
			shareProfile();
		}
	}, [profileAutoUpdate, strippedPlayerData]);

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

	const StaleMessage = () => {
		const STALETHRESHOLD = 3;	// in hours
		if (showIfStale && new Date().getTime()-(playerData.calc?.lastModified?.getTime() ?? 0) > STALETHRESHOLD*60*60*1000) {
			return (
				<Message
					warning
					icon='clock'
					header='Update your player data'
					content="It's been a few hours since you last updated your player data. We recommend that you update now to make sure our tools are providing you recent information about your crew."
					onDismiss={() => setShowIfStale(false)}
				/>
			);
		}
		else {
			return (<></>);
		}
	};

	const ShareMessage = () => {
		if (!showShare) return (<></>);

		// The option to auto-share profile only appears after a profile is uploaded or if previously set to auto-update
		const bShowUploaded = profileUploaded || profileAutoUpdate;

		return (
			<Message icon onDismiss={() => setShowShare(false)}>
				<Icon name='share alternate' />
				<Message.Content>
					<Message.Header>Share your player profile!</Message.Header>
					{!bShowUploaded && (
						<div>
							<p>
								Click here to{' '}
								<Button size='small' color='green' onClick={() => shareProfile()}>
									{profileUploading && <Icon loading name='spinner' />}share your profile
									</Button>{' '}
									and unlock more tools and export options for items and ships. More details:
							</p>
							<Message.List>
								<Message.Item>
									Once shared, the profile will be publicly accessible, will be accessible by your DBID link, and linked on related pages (such as fleet pages & event pages)
									</Message.Item>
								<Message.Item>
									There is no private information included in the player profile; information being shared is limited to:{' '}
									<b>captain name, level, vip level, fleet name and role, achievements, completed missions, your crew, items and ships.</b>
								</Message.Item>
							</Message.List>
						</div>
					)}
					{bShowUploaded && (
						<Form.Group>
							<p>
								Your profile was uploaded. Share the link:{' '}
								<a
									href={`${process.env.GATSBY_DATACORE_URL}profile/?dbid=${playerData.player.dbid}`}
									target='_blank'>{`${process.env.GATSBY_DATACORE_URL}profile/?dbid=${playerData.player.dbid}`}</a>
							</p>
							<Form.Field
								control={Checkbox}
								label='Automatically share profile after every import'
								checked={profileAutoUpdate}
								onChange={(e, { checked }) => setProfileAutoUpdate(checked)}
							/>
						</Form.Group>
					)}
				</Message.Content>
			</Message>
		);
	};

	if (!varsReady)
		return (<PlayerToolsLoading />);

	const PlayerLevelProgress = () => {
		const endingValue = playerData.player.character.xp_for_next_level - playerData.player.character.xp_for_current_level;
		const currentValue = playerData.player.character.xp - playerData.player.character.xp_for_current_level;
		const percent = (currentValue / endingValue) * 100;
		return (
		  <Progress
			percent={percent.toPrecision(3)}
			label={`Level ${playerData.player.character.level}: ${playerData.player.character.xp} / ${playerData.player.character.xp_for_next_level}`}
			progress
		  />
		);
	 };

	return (
		<Layout title='Player tools'>
			<Header as='h4'>Hello, {playerData.player.character.display_name}</Header>
			<PlayerLevelProgress />
			<StaleMessage />
			<Menu compact stackable>
				<Menu.Item>
					Last imported: {playerData.calc?.lastModified?.toLocaleString()}
				</Menu.Item>
				<Dropdown item text='Profile options'>
					<Dropdown.Menu>
						<Dropdown.Item onClick={() => requestShowForm(true)}>Update now...</Dropdown.Item>
						{!showShare && (<Dropdown.Item onClick={() => setShowShare(true)}>Share profile...</Dropdown.Item>)}
						<Dropdown.Item onClick={() => requestClearData()}>Clear player data</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown>
			  <Dropdown item text='Export'>
				<Dropdown.Menu>
					<Popup basic content='Download crew data as traditional comma delimited CSV file' trigger={
						<Dropdown.Item onClick={() => exportCrewTool()} content='Download CSV...' />
					} />
					<Popup basic content='Copy crew data to clipboard in Google Sheets format' trigger={
						<Dropdown.Item onClick={() => exportCrewToClipboard()} content='Copy to clipboard' />
					} />
				</Dropdown.Menu>
			</Dropdown>
			</Menu>

			<React.Fragment>
				<ShareMessage />
				<Header as='h3'>{tools[activeTool].title}</Header>
				{tools[activeTool].render(props)}
			</React.Fragment>
		</Layout>
	);

	function variableReady(keyName: string) {
		setVarsReady(true);
	}

	function shareProfile() {
		setProfileUploading(true);

		let jsonBody = JSON.stringify({
			dbid: playerData.player.dbid,
			player_data: strippedPlayerData
		});

		fetch(`${process.env.GATSBY_DATACORE_URL}api/post_profile`, {
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			body: jsonBody
		}).then(() => {
			if (!profileAutoUpdate) window.open(`${process.env.GATSBY_DATACORE_URL}profile/?dbid=${playerData.player.dbid}`, '_blank');
			setProfileUploading(false);
			setProfileUploaded(true);
			setProfileShared(true);
		});
	}

	function exportCrewTool() {
		let text = playerData.player.character.unOwnedCrew ? exportCrew(playerData.player.character.crew.concat(playerData.player.character.unOwnedCrew)) : "";
		downloadData(`data:text/csv;charset=utf-8,${encodeURIComponent(text)}`, 'crew.csv');
	}

	function exportCrewToClipboard() {
		let text = playerData.player.character.unOwnedCrew ? exportCrew(playerData.player.character.crew.concat(playerData.player.character.unOwnedCrew), '\t') : "";
		navigator.clipboard.writeText(text);
	}
}

type PlayerToolsFormProps = {
	setValidInput: (playerData: any) => void;
};

const PlayerToolsForm = (props: PlayerToolsFormProps) => {
	const PLAYERLINK = 'https://app.startrektimelines.com/player?client_api=17&only_read_state=true';

	const { setValidInput } = props;

	const [inputPlayerData, setInputPlayerData] = React.useState(undefined);
	const [fullInput, setFullInput] = React.useState('');
	const [displayedInput, setDisplayedInput] = React.useState('');
	const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);

	let inputUploadFile: HTMLInputElement | null = null;

	if (fullInput != "")
		parseInput();

	React.useEffect(() => {
		if (inputPlayerData) {
			setValidInput(inputPlayerData);
			setInputPlayerData(undefined);
		}
	}, [inputPlayerData]);

	const frameLoaded = () => {
		let el = document.getElementById("_frame1") as HTMLIFrameElement;
		if (el) {
			
			let text = el.contentWindow?.document.textContent;
			if (text) {
				try {
					let json = JSON.parse(text);
					if (json && "forte_root" in json) {
						setInputPlayerData(json);
					}
				}
				catch {

				}
			}
		}
	}
	return (
		<Layout title='Player tools'>
			<Header as='h2'>Player tools</Header>
			<p>You can access some of your player data from the game's website and import it here to calculate optimal voyage lineups, identify unnecessary items, export your crew list as a CSV, or share your profile with other players, among other tools. This website cannot make direct requests to the game's servers due to security configurations and unclear terms of service interpretations, so there are a few manual steps required to import your data.</p>
			<p>If you have multiple accounts, we recommend using your browser in InPrivate mode (Edge) or Incognito mode (Firefox / Chrome) to avoid caching your account credentials, making it easier to change accounts.</p>
			<ul>
				<li>
					Open this page in your browser:{' '}
					<a href={PLAYERLINK} target='_blank'>
						{PLAYERLINK}
						</a>
				</li>
				<li>
					Log in if asked, then wait for the page to finish loading. It should start with:{' '}
					<span style={{ fontFamily: 'monospace' }}>{'{"action":"update","player":'}</span> ...
					</li>
				<li>Select everything in the page (Ctrl+A) and copy it (Ctrl+C)</li>
				<li>Paste it (Ctrl+V) in the text box below. Note that DataCore will intentionally display less data here to speed up the process</li>
				<li>Click the 'Import data' button</li>
			</ul>

			<Form>
				<TextArea
					placeholder='Paste your player data here'
					value={displayedInput}
					onChange={(e, { value }) => setDisplayedInput(value as string)}
					onPaste={(e: ClipboardEvent) => { return onInputPaste(e) }}
				/>
				<input
					type='file'
					onChange={(e) => { handleFileUpload(e) }}
					style={{ display: 'none' }}
					ref={e => inputUploadFile = e}
				/>
			</Form>
			<Button
				onClick={() => parseInput()}
				style={{ marginTop: '1em' }}
				content='Import data'
				icon='paste'
				labelPosition='right'
			/>

			{errorMessage && (
				<Message negative>
					<Message.Header>Error</Message.Header>
					<p>{errorMessage}</p>
				</Message>
			)}			
			
			<p style={{ marginTop: '2em' }}>To circumvent the long text copy limitations on mobile devices, download{' '}
				<a href={PLAYERLINK} target='_blank'>
					your player data
						</a>
				{' '}to your device, then click the 'Upload data file' button.
					</p>
			<p>
				<Modal
					trigger={<a href="#">Click here for detailed instructions for Apple iOS devices.</a>}
					header='Player data upload on iOS'
					content={<ul>
						<li>Go to your player data using the link provided, logging in if asked.</li>
						<li>Wait for the page to finish loading. It should start with:{' '}
							<span style={{ fontFamily: 'monospace' }}>{'{"action":"update","player":'}</span> ...
								</li>
						<li>Press the share icon while viewing the page.</li>
						<li>Tap 'options' and choose 'Web Archive', tap 'save to files', choose a location and save.</li>
						<li>Come back to this page (DataCore.app player tools).</li>
						<li>Tap the 'Upload data file' button.</li>
						<li>Choose the file starting with 'player?client_api...' from where you saved it.</li>
					</ul>}
				/>
			</p>

			<Button
				onClick={() => inputUploadFile?.click()}
				content='Upload data file'
				icon='file'
				labelPosition='right'
			/>
		</Layout>
	);

	function parseInput() {
		let testInput = fullInput;

		// Use inputted text if no pasted text detected
		if (testInput == '') testInput = displayedInput;

		try {
			let testData = JSON.parse(testInput as string);

			if (testData) {
				// Test for playerData array glitch
				if (Array.isArray(testData)) {
					testData = {...testData[0]};
				}
				if (testData.player && testData.player.display_name) {
					if (testData.player.character && testData.player.character.crew && (testData.player.character.crew.length > 0)) {
						setInputPlayerData(testData);
						setDisplayedInput('');
						setErrorMessage(undefined);
					} else {
						setErrorMessage('Failed to parse player data from the text you pasted. Make sure you are logged in with the correct account.');
					}
				}
				else {
					setErrorMessage('Failed to parse player data from the text you pasted. Make sure the page is loaded correctly and you copied the entire contents!');
				}
			} else {
				setErrorMessage('Failed to parse player data from the text you pasted. Make sure the page is loaded correctly and you copied the entire contents!');
			}
		} catch (err) {
			if ((/Log in to CS Tools/).test(testInput)) {
				setErrorMessage('You are not logged in! Open the player data link above and log in to the game as instructed. Then return to this DataCore page and repeat all the steps to import your data.');
			}
			else {
				setErrorMessage(`Failed to read the data. Make sure the page is loaded correctly and you copied the entire contents! (${err})`);
			}
		}

		setFullInput('');
	}

	function onInputPaste(event: ClipboardEvent) {
		let paste = event.clipboardData;
		if (paste) {
			let fullPaste = paste.getData('text');
			setFullInput(fullPaste);
			setDisplayedInput(`${fullPaste.substr(0, 300)} [ ... ] ${fullPaste.substr(-100)}\n/* Note that DataCore is intentionally displaying less data here to speed up the process */`);
			event.preventDefault();
			return false;
		}
		return true;
	}

	function handleFileUpload(event) {
		// use FileReader to read file content in browser
		const fReader = new FileReader();
		fReader.onload = (e) => {
			let data = e.target?.result?.toString() ?? "";
			// Handle Apple webarchive wrapping
			if (data.match(/^bplist00/)) {
				// Find where the JSON begins and ends, and extract just that from the larger string.
				data = data.substring(data.indexOf('>{') + 1, data.lastIndexOf('}}') + 2);
			}
			setFullInput(data);
		};
		fReader.readAsText(event.target.files[0]);
	}
};


const PlayerToolsLoading = () => {
	return (
		<Layout title='Player tools'>
			<Icon loading name='spinner' /> Loading...
		</Layout>
	);
};

export default PlayerToolsPage;
