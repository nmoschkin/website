import React from 'react';
import { Step } from 'semantic-ui-react';

import DataPageLayout from '../components/page/datapagelayout';
import ItemsTable, { CustomFieldDef } from '../components/items/itemstable';
import { GlobalContext } from '../context/globalcontext';
import { EquipmentItem } from '../model/equipment';
import { binaryLocate, formatDuration, getItemWithBonus, getPossibleQuipment } from '../utils/itemutils';
import { useStateWithStorage } from '../utils/storage';
import { PlayerCrew } from '../model/player';
import { getCrewQuipment, oneCrewCopy } from '../utils/crewutils';

export interface ItemsPageProps {}

const ItemsPage = (props: ItemsPageProps) => {

	const [activeTabIndex, setActiveTabIndex] = useStateWithStorage<number>('items/mode', 0, { rememberForever: true });
	const globalContext = React.useContext(GlobalContext);
	const { t, tfmt } = globalContext.localized;
	const hasPlayer = !!globalContext.player.playerData;
	const allActive = activeTabIndex === 0 || !hasPlayer;

	React.useEffect(() => {
		if (!hasPlayer && activeTabIndex === 1) {
			setActiveTabIndex(0);
		}
	}, [globalContext]);

	const coreItems = JSON.parse(JSON.stringify(globalContext.core.items.filter(item => item.type !== 14 || (!!item.max_rarity_requirement || !!item.traits_requirement?.length)))) as EquipmentItem[];
	const crew = globalContext.core.crew;
	if (hasPlayer) {
		coreItems.forEach((item) => {
			item.quantity = globalContext.player.playerData?.player.character.items.find(i => i.symbol === item.symbol)?.quantity;
		});
	}
	coreItems.sort((a, b) => a.symbol.localeCompare(b.symbol));
	const crewLevels: { [key: string]: Set<string>; } = {};
	crew.forEach(cr => {
		cr.equipment_slots.forEach(es => {
			let item = binaryLocate(es.symbol, coreItems);
			if (item) {
				crewLevels[es.symbol] ??= new Set();
				crewLevels[es.symbol].add(cr.symbol);
			}
		});
	});

	for (let symbol in crewLevels) {
		if (crewLevels[symbol] && crewLevels[symbol].size > 0) {
			let item = binaryLocate(symbol, coreItems);
			if (item) {
				item.flavor ??= "";
				if (item.flavor?.length) item.flavor += "\n";
				if (crewLevels[symbol].size > 5) {
					item.flavor += `Equippable by ${crewLevels[symbol].size} crew`;
				} else {
					item.flavor += 'Equippable by: ' + [...crewLevels[symbol]].join(', ');
				}
			}
		}
	}
	const quipCust = [] as CustomFieldDef[];

	quipCust.push({
			field: 'duration',
			text: t('items.columns.duration'),
			format: (value: number) => formatDuration(value, t)
		});

	if (hasPlayer) {
		quipCust.push({
			field: 'quantity',
			text: t('items.columns.owned'),
			format: (value: number) => value ? (value.toLocaleString()) : t('crew_state.unowned')
		});
	}

	// // Don't delete!!!! This is to preview crew quipment
	// if (globalContext.core?.crew?.length) {
	// 	let crnew = oneCrewCopy(globalContext.core.crew.find(f => f.symbol === 'vash_qless_crew')!);
	// 	crnew!.traits = ["human", "federation", "exoarchaeology", "civilian", "romantic", "crafty", "smuggler", "merchant", "casual", "playful"]
	// 	crnew!.skill_order = ['science_skill', 'diplomacy_skill', 'medicine_skill']
	// 	crnew!.base_skills.medicine_skill = crnew!.base_skills.command_skill;
	// 	delete crnew!.base_skills.command_skill;
	// 	let crewquip = getPossibleQuipment(crnew as PlayerCrew, globalContext.core.items.filter(f => f.type === 14));
	// 	let text = '';
	// 	if (crewquip?.length) {
	// 		crewquip.forEach(item => {
	// 			let bonus = getItemWithBonus(item);
	// 			text += (`${item.name}\n    ${bonus.bonusInfo.bonusText.join('\n    ')}\n`)
	// 		})
	// 		console.log(text);
	// 	}
	// }

	return (

		<DataPageLayout playerPromptType='recommend' pageTitle={t('menu.roster.items')} demands={['all_buffs', 'episodes', 'crew', 'items', 'cadet']}>
			<React.Fragment>

			<Step.Group fluid>
				<Step active={activeTabIndex === 0} onClick={() => setActiveTabIndex(0)}>
					<Step.Content>
						<Step.Title>{t('item_picker.all_items.title')}</Step.Title>
						<Step.Description>{tfmt('item_picker.all_items.description')}</Step.Description>
					</Step.Content>
				</Step>

				{hasPlayer && <Step active={activeTabIndex === 1} onClick={() => setActiveTabIndex(1)}>
					<Step.Content>
						<Step.Title>{t('item_picker.owned_items.title')}</Step.Title>
						<Step.Description>{tfmt('item_picker.owned_items.description')}</Step.Description>
					</Step.Content>

				</Step>}

				<Step active={activeTabIndex === 2} onClick={() => setActiveTabIndex(2)}>
					<Step.Content>
						<Step.Title>{t('item_picker.quipment_browser.title')}</Step.Title>
						<Step.Description>{tfmt('item_picker.quipment_browser.description')}</Step.Description>
					</Step.Content>
				</Step>
			</Step.Group>


			{/* We want both of these to load, even if they are not displayed,
				because there's work that that must be done every time they are loaded.
				Re-rendering the page for switching views would cause work to run unnecessarily. */}

			<ItemsTable
				pageName={"core"}
				noRender={activeTabIndex !== 0}
				data={coreItems}
				hideOwnedInfo={true}
				noWorker={true}
				flavor={true} />

			{hasPlayer && <ItemsTable
				pageName={"roster"}
				noRender={activeTabIndex !== 1 || !hasPlayer} />}

			<ItemsTable
				pageName={"roster"}
				types={[14]}
				buffs={true}
				crewMode={true}
				noWorker={true}
				noRender={activeTabIndex !== 2}
				data={coreItems}
				hideOwnedInfo={true}
				flavor={false}
				customFields={quipCust}
				/>
				<br />
				<br />

			</React.Fragment>
		</DataPageLayout>
	);
};


export default ItemsPage;
